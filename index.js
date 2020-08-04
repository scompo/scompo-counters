const SimpleWebAuthnServer = require('@simplewebauthn/server')
const express = require('express')
const https = require('https')
const http = require('http')
const fs = require('fs')
const db = require('./db')
const config = require('./config')

const app = express()

app.use(express.static('./public'))
app.use(express.json())

app.get('/webauthn/register/start', async (req, res) => {
  const challenge = 'aNewUniqueChallengeEveryRegistration' // TODO implment it correctly

  const username = req.query.username

  let user = await db.getUser(username)

  if (!user) {
    user = await db.newUser(username)
  }

  user.currentChallenge = challenge

  user = await db.saveUser(user)

  res.json(
    SimpleWebAuthnServer.generateAttestationOptions({
      serviceName: 'scompo-counters',
      rpID: config.rpID,
      challenge: challenge,
      userID: username,
      userName: user.userName,
      timeout: 60 * 1000,
      attestationType: 'direct',
      excludedCredentialsIDs: user.devices.map(x => x.credentialID),
      authenticatiorSelection: {
        userVerification: 'preferred',
        requireResidentKey: false
      }
    }))
})

app.post('/webauthn/register/end', async (req, res) => {
  const body = req.body
  const username = req.body.username

  let user = await db.getUser(username)

  const expectedChallenge = await user.currentChallenge

  SimpleWebAuthnServer.verifyAttestationResponse({
    credential: body,
    expectedChallenge: expectedChallenge,
    expectedOrigin: config.origin,
    expectedRPID: config.rpID
  })
    .then(async verification => {
      const { verified, authenticatorInfo } = verification
      if (verified) {
        const { base64PublicKey, base64CredentialID, counter } = authenticatorInfo
        const existingDevice = user.devices.find(d => d.credentialID === base64CredentialID)
        if (!existingDevice) {
          user.devices.push({
            publicKey: base64PublicKey,
            credentialID: base64CredentialID,
            counter: counter
          })
        }
      }
      user = await db.saveUser(user)
      res.json({ verified })
    })
    .catch(e => {
      console.error(e)
      res.status(400).json(e)
    })
})

app.get('/webauthn/login/start', async (req, res) => {
  const challenge = 'aNewUniqueChallengeEveryAttestation' // TODO implment it correctly
  const username = req.query.username

  let user = await db.getUser(username)

  user.currentChallenge = challenge

  user = await db.saveUser(user)

  res.json(
    SimpleWebAuthnServer.generateAssertionOptions({
      challenge: challenge,
      timeout: 60 * 1000,
      allowedCredentialIDs: user.devices.map(x => x.credentialID),
      userVerification: 'preferred'
    }))
})

app.post('/webauthn/login/end', async (req, res) => {
  const body = req.body
  const username = body.username

  let user = await db.getUser(username)

  const expectedChallenge = user.currentChallenge
  const dbAuthenticator = user.devices.find(x => x.credentialID === body.id)
  if (!dbAuthenticator) {
    throw new Error('Could not find authenticator matching', body.id)
  }
  try {
    const verification = SimpleWebAuthnServer.verifyAssertionResponse({
      credential: body,
      expectedChallenge: expectedChallenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      authenticator: dbAuthenticator
    })
    const { verified, authenticatorInfo } = verification
    if (verified) {
      dbAuthenticator.counter = authenticatorInfo.counter
    }
    user = db.saveUser(user)
    res.json({ verified })
  } catch (e) {
    console.error(e)
    res.status(400).json(e)
  }
})

let server

if (config.useHttps) {
  server = https.createServer({
    key: fs.readFileSync(`./${config.rpID}.key`),
    cert: fs.readFileSync(`./${config.rpID}.crt`)
  }, app)
} else {
  server = http.createServer(app)
}
server.listen(config.port, config.host, () => {
  console.log(`Server started on https://${config.host}:${config.port}`)
})
