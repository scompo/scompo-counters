/* global SimpleWebAuthnBrowser */

const elemBegin = document.getElementById('btnBegin')
const elemSuccess = document.getElementById('success')
const elemError = document.getElementById('error')
const elemUsername = document.getElementById('inputUsername')

const { startAssertion, supportsWebauthn } = SimpleWebAuthnBrowser

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

  const resp = await window.fetch('/webauthn/login/start?username=' + username)

  let asseResp
  try {
    const opts = await resp.json()
    asseResp = await startAssertion(opts)
  } catch (error) {
    elemError.innerText = error
    throw new Error(error)
  }

  asseResp.username = username

  const verificationResp = await window.fetch('/webauthn/login/end', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(asseResp)
  })

  const verificationJSON = await verificationResp.json()

  if (verificationJSON && verificationJSON.verified) {
    elemSuccess.innerHTML = 'Success! <a href="/register">Try to register again?</a>'
  } else {
    elemError.innerHTML = `Oh no, something went wrong! Response: <pre>${JSON.stringify(
            verificationJSON
        )}</pre>`
  }
})
