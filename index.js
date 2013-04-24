// clustermq

var amqp = require("amqp")

exports.declare = function (whatever, callback) {
  process.nextTick(function () {
    callback({ whatever: whatever })
  })
}

