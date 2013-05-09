//
// # NativePullQueue
//
// TODO: Description.
//
var cluster = require('cluster')
  , EventEmitter = require('events').EventEmitter
  , util = require('util')

//
// ## NativePullQueue `NativePullQueue(obj)`
//
// Creates a new instance of NativePullQueue with the following options:
//
function NativePullQueue(obj) {
  if (!(this instanceof NativePullQueue)) {
    return new NativePullQueue(obj)
  }

  EventEmitter.call(this)

  obj = obj || {}

  this.name = obj.name || ''
  this.queue = obj.queue || null

  this._init()
}
util.inherits(NativePullQueue, EventEmitter)
NativePullQueue.createQueue = NativePullQueue

//
// ## subscribe `subscribe([handler])`
//
// If provided, **handler** will be added as a `'message'` event listener for this queue.
//
NativePullQueue.prototype.subscribe = subscribe
function subscribe(handler) {
  var self = this

  if (typeof handler === 'function') {
    self.on('message', handler)
  }

  return self
}

//
// ## _init `_init()`
//
// Internal use only.
//
// Establishes internal state, event handlers, etc.
//
NativePullQueue.prototype._init = cluster.isMaster ? master_init : worker_init
function master_init() {
  var self = this

  if (!self.queue) {
    // This will only happen if NativePullQueue is used externally and improperly.
    throw new Error('No underlying queue was created.')
  }

  self.queue.pushWorker({
    send: function (data) {
      self.emit('message', data.msg)
    }
  })

  return self
}
function worker_init() {
  var self = this

  process.on('message', function (data) {
    if (data.name === self.name && data.type === 'push') {
      self.emit('message', data.msg)
    }
  })

  process.send({
    type: 'startpull',
    name: self.name
  })

  return self
}

module.exports = NativePullQueue
