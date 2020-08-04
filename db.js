const config = require('./config')
const userdb = {}

module.exports = {
  getUser: async function (username) {
    return userdb[username]
  },
  saveUser: async function (user) {
    const username = user.id
    userdb[username] = user
    return this.getUser(username)
  },
  users: async function () {
    return Object.keys(userdb)
  },
  newUser: async function (username) {
    return {
      id: username,
      userName: `${username}@${config.rpID}`,
      devices: []
    }
  }
}
