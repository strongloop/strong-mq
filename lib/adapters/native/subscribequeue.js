//
// # NativeSubscribeQueue
//
// TODO: Description.
//
var cluster = require('cluster')
  , EventEmitter = require('events').EventEmitter
  , util = require('util')

//
// ## NativeSubscribeQueue `NativeSubscribeQueue(obj)`
//
// Creates a new instance of NativeSubscribeQueue with the following options:
//
function NativeSubscribeQueue(obj) {
  if (!(this instanceof NativeSubscribeQueue)) {
    return new NativeSubscribeQueue(obj)
  }

  EventEmitter.call(this)

  obj = obj || {}

  this.name = obj.name
  this.queue = obj.queue || null
}
util.inherits(NativeSubscribeQueue, EventEmitter)
NativeSubscribeQueue.createQueue = NativeSubscribeQueue

//
// ## subscribe `subscribe(pattern)`
//
// Subscribes to **pattern**, increasing the types of `message` events emitted.
//
NativeSubscribeQueue.prototype.subscribe = cluster.isMaster ? masterSubscribe : workerSubscribe
function masterSubscribe(pattern) {
  var self = this
    , regexp = RegExp('^' + pattern + '\\.')

  if (!self.queue) {
    // This will only happen if NativeSubscribeQueue is used externally and improperly.
    throw new Error('No underlying queue was created.')
  }

  self.queue.on('publish', function (data) {
    if (regexp.test(data.topic + '.')) {
      self.emit('message', data.msg)
    }
  })

  return self
}
function workerSubscribe(pattern) {
  var self = this
    , regexp = RegExp('^' + pattern + '\\.')

  process.on('message', function (data) {
    if (data.name === self.name && data.type === 'publish' && regexp.test(data.topic + '.')) {
      self.emit('message', data.msg)
    }
  })

  return self
}

module.exports = NativeSubscribeQueue
