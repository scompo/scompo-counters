/* global SimpleWebAuthnBrowser */

const elemBegin = document.getElementById('btnBegin')
const elemSuccess = document.getElementById('success')
const elemError = document.getElementById('error')
const elemUsername = document.getElementById('inputUsername')

const { startAttestation, supportsWebauthn } = SimpleWebAuthnBrowser

// Hide the Begin button if the browser is incapable of using WebAuthn
if (!supportsWebauthn()) {
  elemBegin.style.display = 'none'
  elemError.innerText = 'It seems this browser doesn\'t support WebAuthn...'
}

elemBegin.addEventListener('click', async () => {
  // Reset success/error messages
  elemSuccess.innerHTML = ''
  elemError.innerHTML = ''
  const username = elemUsername.value

  const resp = await window.fetch('/webauthn/register/start?username=' + username).then(r => r.json())

  let attResp
  try {
    attResp = await startAttestation(resp)
  } catch (error) {
    if (error.name === 'InvalidStateError') {
      elemError.innerText = 'Error: Authenticator was probably already registered by user'
    } else {
      elemError.innerText = error
    }

    throw error
  }

  const data = attResp

  data.username = username

  const verificationResp = await window.fetch('/webauthn/register/end', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(data)
  })

  const verificationJSON = await verificationResp.json()

  if (verificationJSON && verificationJSON.verified) {
    elemSuccess.innerHTML = 'Success! <a href="/login">Now try to log in</a>'
  } else {
    elemError.innerHTML = `Oh no, something went wrong! Response: <pre>${JSON.stringify(
            verificationJSON
        )}</pre>`
  }
})
