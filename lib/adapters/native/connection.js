//
// # NativeConnection
//
var cluster = require('cluster');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var NativePushQueue = require('./pushqueue');
var NativePullQueue = require('./pullqueue');
var NativePublishQueue = require('./publishqueue');
var NativeSubscribeQueue = require('./subscribequeue');
var WorkQueue = require('./workqueue');

//
// ## NativeConnection `NativeConnection(obj)`
//
// Creates a new instance of NativeConnection. No options are exposed.
//
function NativeConnection(provider, url, options) {
  EventEmitter.call(this);

  this.provider = provider;

  this._init(); // XXX(sam) this should be in the open, should it not?
}
util.inherits(NativeConnection, EventEmitter);
NativeConnection.createConnection = NativeConnection;

//
// ## open `open()`
//
// Opens the Connection.
//
NativeConnection.prototype.open = cluster.isMaster ? masterOpen : workerOpen;
function masterOpen() {
  var self = this;

  // Nothing to do.

  return self;
}
function workerOpen() {
  var self = this;

  // Nothing to do.

  return self;
}

//
// ## close `close()`
//
// Closes the Connection.
//
NativeConnection.prototype.close = function (callback) {
  var self = this;

  if (callback) {
    process.nextTick(callback);
  }

  self._final();

  return self;
};

//
// ## createPushQueue `createPushQueue(name)`
//
// Returns a new PushQueue instance for **name**. If no underlying queue resource exists, one will be created.
//
NativeConnection.prototype.createPushQueue = cluster.isMaster ? masterCreatePushQueue : workerCreatePushQueue;
function masterCreatePushQueue(name) {
  var self = this;
  var queue = self._getWorkQueue(name);

  return NativePushQueue.createQueue({
    name: name,
    queue: queue
  });
}
function workerCreatePushQueue(name) {
  var self = this;

  return NativePushQueue.createQueue({
    name: name
  });
}

//
// ## createPullQueue `createPullQueue(name)`
//
// Returns a new PullQueue instance for **name**. If no underlying queue resource exists, one will be created.
//
NativeConnection.prototype.createPullQueue = cluster.isMaster ? masterCreatePullQueue : workerCreatePullQueue;
function masterCreatePullQueue(name) {
  var self = this;
  var queue = self._getWorkQueue(name);

  return NativePullQueue.createQueue({
    name: name,
    queue: queue
  });
}
function workerCreatePullQueue(name) {
  var self = this;

  return NativePullQueue.createQueue({
    name: name
  });
}

NativeConnection.prototype.createPubQueue = cluster.isMaster ? masterCreatePublishQueue : workerCreatePublishQueue;
function masterCreatePublishQueue(name) {
  var self = this;
  var queue = self._getTopicQueue(name);

  return NativePublishQueue.createQueue({
    name: name,
    queue: queue
  });
}
function workerCreatePublishQueue(name) {
  var self = this;

  return NativePublishQueue.createQueue({
    name: name
  });
}

NativeConnection.prototype.createSubQueue = cluster.isMaster ? masterCreateSubscribeQueue : workerCreateSubscribeQueue;
function masterCreateSubscribeQueue(name) {
  var self = this;
  var queue = self._getTopicQueue(name);

  return NativeSubscribeQueue.createQueue({
    name: name,
    queue: queue
  });
}
function workerCreateSubscribeQueue(name) {
  var self = this;

  return NativeSubscribeQueue.createQueue({
    name: name
  });
}

//
// ## _init `_init()`
//
// Internal use only.
//
// Establishes internal state, event handlers, etc.
//
// XXX(sam) Maybe this should be a singleton? Otherwise, multiple connections all
// are connected to the same master.
NativeConnection.prototype._init = cluster.isMaster ? masterInit : workerInit;
function masterInit() {
  var self = this;

  self._topicQueues = {};
  self._workQueues = {};

  // For each worker that is created, listen to its messages.
  self._onFork = function onFork(worker) {
    worker.on('message', function(data) {
      switch (data.type) {
        case 'publishreq':
          // TODO(schoon): Is this cheating too much?
          // TODO(sam): It's ok to cheat as long as nobody notices.
          self.createPubQueue(data.name).publish(data.topic, data.msg);
        break;
        case 'startpull':
          self._getWorkQueue(data.name).pushWorker(worker);
        break;
        case 'stoppull':
          self._getWorkQueue(data.name).popWorker(worker);
        break;
        case 'pushreq':
          data.type = 'push';
        self._getWorkQueue(data.name).push(data);
        break;
      }
    });
  };

  // Scrub all work queues and remove the no-longer-extant worker.
  self._onDisconnect = function onDisconnect(worker) {
    Object.keys(self._workQueues).forEach(function(key) {
      self._workQueues[key].popWorker(worker);
    });
  };

  cluster.on('fork', self._onFork);
  cluster.on('disconnect', self._onDisconnect);

  return self;
}
function workerInit() {
  var self = this;

  // Nothing to do.

  return self;
}

//
// ## _final `_final()`
//
// Internal use only.
//
// Undoes whatever _init did
//
NativeConnection.prototype._final = cluster.isMaster ? masterFinal : workerFinal;
function masterFinal() {
  var self = this;
  cluster.removeListener('fork', self._onFork);
  cluster.removeListener('disconnect', self._onDisconnect);
}
function workerFinal() {
}

//
// ## _getWorkQueue `_getWorkQueue(name)`
//
// Internal use only.
//
// Returns the WorkQueue named **name**, creating one if it doesn't already exist.
//
NativeConnection.prototype._getWorkQueue = _getWorkQueue;
function _getWorkQueue(name) {
  var self = this;
  var queue = self._workQueues[name];

  if (!queue) {
    queue = self._workQueues[name] = new WorkQueue();
  }

  return queue;
}

//
// ## _getTopicQueue `_getTopicQueue(name)`
//
// Internal use only.
//
// Returns the TopicQueue named **name**, creating one if it doesn't already exist.
//
NativeConnection.prototype._getTopicQueue = _getTopicQueue;
function _getTopicQueue(name) {
  var self = this;
  var queue = self._topicQueues[name];

  if (!queue) {
    queue = self._topicQueues[name] = new EventEmitter();
  }

  return queue;
}

module.exports = NativeConnection;
