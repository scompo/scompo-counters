const SimpleWebAuthnServer = require('@simplewebauthn/server')
const express = require('express')
const https = require('https')
const http = require('http')
const fs = require('fs')

const username = 'testUsername'
const rpID = process.env.RP_ID || 'localhost'
const origin = `https://${rpID}`

const host = '0.0.0.0'
const port = process.env.PORT || 443
const useHttps = process.env.USE_HTTPS || false

const memoryDB = {
  [username]: {
    id: username,
    username: `user@${rpID}`,
    devices: []
  }
}

const app = express()

app.use(express.static('./public'))
app.use(express.json())

app.get('/webauthn/register/start', async (req, res) => {
  const challenge = 'aNewUniqueChallengeEveryRegistration' // TODO implment it correctly
  console.log(memoryDB)
  memoryDB[username].currentChallenge = challenge

  res.json(
    SimpleWebAuthnServer.generateAttestationOptions({
      serviceName: 'scompo-counters',
      rpID: rpID,
      challenge: challenge,
      userID: username,
      userName: username,
      timeout: 60 * 1000,
      attestationType: 'direct',
      excludedCredentialsIDs: memoryDB[username].devices.map(x => x.credentialID),
      authenticatiorSelection: {
        userVerification: 'preferred',
        requireResidentKey: false
      }
    }))
})

app.post('/webauthn/register/end', async (req, res) => {
  const body = req.body
  const expectedChallenge = memoryDB[username].currentChallenge
  SimpleWebAuthnServer.verifyAttestationResponse({
    credential: body,
    expectedChallenge: expectedChallenge,
    expectedOrigin: origin,
    expectedRPID: rpID
  })
    .then(verification => {
      const { verified, authenticatorInfo } = verification
      if (verified) {
        const { base64PublicKey, base64CredentialID, counter } = authenticatorInfo
        const existingDevice = memoryDB[username].devices.find(d => d.credentialID === base64CredentialID)
        if (!existingDevice) {
          memoryDB[username].devices.push({
            publicKey: base64PublicKey,
            credentialID: base64CredentialID,
            counter: counter
          })
          console.log('after registration', memoryDB)
        }
      }
      res.json({ verified })
    })
    .catch(e => {
      console.error(e)
      res.status(400).json(e)
    })
})

app.get('/webauthn/login/start', async (req, res) => {
  const challenge = 'aNewUniqueChallengeEveryAttestation' // TODO implment it correctly
  memoryDB[username].currentChallenge = challenge
  console.log('login start:', memoryDB)

  res.json(
    SimpleWebAuthnServer.generateAssertionOptions({
      challenge: challenge,
      timeout: 60 * 1000,
      allowedCredentialIDs: memoryDB[username].devices.map(x => x.credentialID),
      userVerification: 'preferred'
    }))
})

app.post('/webauthn/login/end', async (req, res) => {
  const body = req.body
  const expectedChallenge = memoryDB[username].currentChallenge
  const dbAuthenticator = memoryDB[username].devices.find(x => x.credentialID === body.id)
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
