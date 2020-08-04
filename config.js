const rpID = process.env.RP_ID || 'localhost'

module.exports = {
  host: '0.0.0.0',
  port: process.env.PORT || 8080,
  useHttps: process.env.USE_HTTPS || false,
  rpID: rpID,
  origin: `https://${rpID}`
}
