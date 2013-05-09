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
  , WorkQueue = require('./workqueue')

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
NativeConnection.prototype.createPushQueue = cluster.isMaster ? masterCreatePushQueue : workerCreatePushQueue
function masterCreatePushQueue(name) {
  var self = this
    , queue = self._getWorkQueue(name)

  return NativePushQueue.createQueue({
    name: name,
    queue: queue
  })
}
function workerCreatePushQueue(name) {
  var self = this

  return NativePushQueue.createQueue({
    name: name
  })
}

//
// ## createPullQueue `createPullQueue(name)`
//
// Returns a new PullQueue instance for **name**. If no underlying queue resource exists, one will be created.
//
NativeConnection.prototype.createPullQueue = cluster.isMaster ? masterCreatePullQueue : workerCreatePullQueue
function masterCreatePullQueue(name) {
  var self = this
    , queue = self._getWorkQueue(name)

  return NativePullQueue.createQueue({
    name: name,
    queue: queue
  })
}
function workerCreatePullQueue(name) {
  var self = this

  return NativePullQueue.createQueue({
    name: name
  })
}

//
// ## createPublishQueue `createPublishQueue(name)`
//
// Returns a new PublishQueue instance for **name**. If no underlying queue resource exists, one will be created.
//
NativeConnection.prototype.createPublishQueue = cluster.isMaster ? masterCreatePublishQueue : workerCreatePublishQueue
function masterCreatePublishQueue(name) {
  var self = this
    , queue = self._getTopicQueue(name)

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
    , queue = self._getTopicQueue(name)

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
      switch (data.type) {
        case 'publishreq':
          // TODO: Is this cheating too much?
          self.createPublishQueue(data.name).publish(data.topic, data.msg)
          break
        case 'startpull':
          self._getWorkQueue(data.name).pushWorker(worker)
          break
        case 'stoppull':
          self._getWorkQueue(data.name).popWorker(worker)
          break
        case 'pushreq':
          data.type = 'push'
          self._getWorkQueue(data.name).push(data)
          break
      }
    })
  })

  // Scrub all work queues and remove the no-longer-extant worker.
  cluster.on('disconnect', function (worker) {
    Object.keys(self._workQueues).forEach(function (key) {
      self._workQueues[key].popWorker(worker)
    })
  })

  return self
}
function worker_init() {
  var self = this

  // Nothing to do.

  return self
}

//
// ## _getWorkQueue `_getWorkQueue(name)`
//
// Internal use only.
//
// Returns the WorkQueue named **name**, creating one if it doesn't already exist.
//
NativeConnection.prototype._getWorkQueue = _getWorkQueue
function _getWorkQueue(name) {
  var self = this
    , queue = self._workQueues[name]

  if (!queue) {
    queue = self._workQueues[name] = new WorkQueue()
  }

  return queue
}

//
// ## _getTopicQueue `_getTopicQueue(name)`
//
// Internal use only.
//
// Returns the TopicQueue named **name**, creating one if it doesn't already exist.
//
NativeConnection.prototype._getTopicQueue = _getTopicQueue
function _getTopicQueue(name) {
  var self = this
    , queue = self._topicQueues[name]

  if (!queue) {
    queue = self._topicQueues[name] = new EventEmitter()
  }

  return queue
}

module.exports = NativeConnection
