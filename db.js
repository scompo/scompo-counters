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
  }
}
