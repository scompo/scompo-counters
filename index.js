const SimpleWebAuthnServer = require('@simplewebauthn/server')
const express = require('express')
const https = require('https')
const http = require('http')
const fs = require('fs')
const db = require('./db')

const host = '0.0.0.0'
const port = process.env.PORT || 8080
const useHttps = process.env.USE_HTTPS || false

const rpID = process.env.RP_ID || 'localhost'
const origin = `http://${rpID}:${port}`

const app = express()

app.use(express.static('./public'))
app.use(express.json())

app.get('/webauthn/register/start', async (req, res) => {
  const challenge = 'aNewUniqueChallengeEveryRegistration' // TODO implment it correctly

  const username = req.query.username

  let user = await db.getUser(username)

  if (!user) {
    user = {
      id: username,
      userName: `user@${rpID}`,
      devices: []
    }
  }

  user.currentChallenge = challenge

  user = await db.saveUser(user)

  res.json(
    SimpleWebAuthnServer.generateAttestationOptions({
      serviceName: 'scompo-counters',
      rpID: rpID,
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
    expectedOrigin: origin,
    expectedRPID: rpID
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
      expectedOrigin: origin,
      expectedRPID: rpID,
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

if (useHttps) {
  server = https.createServer({
    key: fs.readFileSync(`./${rpID}.key`),
    cert: fs.readFileSync(`./${rpID}.crt`)
  }, app)
} else {
  server = http.createServer(app)
}
server.listen(port, host, () => {
  console.log(`Server started on https://${host}:${port}`)
})
