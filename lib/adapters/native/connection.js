//
// # NativeConnection
//
// The NativeConnection uses the built-in `cluster` module to facilitate the ClusterMQ API. It's designed to be the
// first adapter people use in early development, before they get Rabbit, Active, etc. set-up.
//
var cluster = require('cluster')
  , EventEmitter = require('events').EventEmitter
  , util = require('util')
  , NativePushQueue = require('./pushqueue')
  , NativePullQueue = require('./pullqueue')
  , NativePublishQueue = require('./publishqueue')
  , NativeSubscribeQueue = require('./subscribequeue')

//
// ## NativeConnection `NativeConnection(obj)`
//
// Creates a new instance of NativeConnection. No options are exposed.
//
function NativeConnection(obj) {
  if (!(this instanceof NativeConnection)) {
    return new NativeConnection(obj)
  }

  EventEmitter.call(this)

  obj = obj || {}

  this._init()
}
util.inherits(NativeConnection, EventEmitter)
NativeConnection.createConnection = NativeConnection

//
// ## open `open()`
//
// Opens the Connection.
//
NativeConnection.prototype.open = cluster.isMaster ? masterOpen : workerOpen
function masterOpen() {
  var self = this

  // Nothing to do.

  return self
}
function workerOpen() {
  var self = this

  // Nothing to do.

  return self
}

//
// ## close `close()`
//
// Closes the Connection.
//
NativeConnection.prototype.close = cluster.isMaster ? masterClose : workerClose
function masterClose() {
  var self = this

  // Nothing to do.

  return self
}
function workerClose() {
  var self = this

  // Nothing to do.

  return self
}

//
// ## createPushQueue `createPushQueue(name)`
//
// Returns a new PushQueue instance for **name**. If no underlying queue resource exists, one will be created.
//
NativeConnection.prototype.createPushQueue = createPushQueue
function createPushQueue(name) {
  var self = this

  return NativePushQueue.createQueue()
}

//
// ## createPullQueue `createPullQueue(name)`
//
// Returns a new PullQueue instance for **name**. If no underlying queue resource exists, one will be created.
//
NativeConnection.prototype.createPullQueue = createPullQueue
function createPullQueue(name) {
  var self = this

  return self
}

//
// ## createPublishQueue `createPublishQueue(name)`
//
// Returns a new PublishQueue instance for **name**. If no underlying queue resource exists, one will be created.
//
NativeConnection.prototype.createPublishQueue = cluster.isMaster ? masterCreatePublishQueue : workerCreatePublishQueue
function masterCreatePublishQueue(name) {
  var self = this
    , queue = self._topicQueues[name]

  if (!queue) {
    queue = self._topicQueues[name] = new EventEmitter()
  }

  return NativePublishQueue.createQueue({
    name: name,
    queue: queue
  })
}
function workerCreatePublishQueue(name) {
  var self = this

  return NativePublishQueue.createQueue({
    name: name
  })
}

//
// ## createSubscribeQueue `createSubscribeQueue(name)`
//
// Returns a new SubscribeQueue instance for **name**. If no underlying queue resource exists, one will be created.
//
NativeConnection.prototype.createSubscribeQueue = cluster.isMaster ? masterCreateSubscribeQueue : workerCreateSubscribeQueue
function masterCreateSubscribeQueue(name) {
  var self = this
    , queue = self._topicQueues[name]

  if (!queue) {
    queue = self._topicQueues[name] = new EventEmitter()
  }

  return NativeSubscribeQueue.createQueue({
    name: name,
    queue: queue
  })
}
function workerCreateSubscribeQueue(name) {
  var self = this

  return NativeSubscribeQueue.createQueue({
    name: name
  })
}

//
// ## _init `_init()`
//
// Internal use only.
//
// Establishes internal state, event handlers, etc.
//
NativeConnection.prototype._init = cluster.isMaster ? master_init : worker_init
function master_init() {
  var self = this

  self._topicQueues = {}
  self._workQueues = {}

  cluster.on('fork', function (worker) {
    worker.on('message', function (data) {
      if (data.type === 'publishreq') {
        // TODO: Is this cheating too much?
        self.createPublishQueue(data.name).publish(data.topic, data.msg)
      }
    })
  })

  return self
}
function worker_init() {
  var self = this

  // Nothing to do.

  return self
}

module.exports = NativeConnection
