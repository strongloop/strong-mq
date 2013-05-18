//
// # NativeConnection
//
var cluster = require('cluster');
var dbg = require('../../dbg');
var broker = require('./broker');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var NativePushQueue = require('./pushqueue');
var NativePullQueue = require('./pullqueue');
var NativePublishQueue = require('./publishqueue');
var NativeSubscribeQueue = require('./subscribequeue');

// Creates a new instance of NativeConnection. No options are exposed.
function NativeConnection(provider, url, options) {
  EventEmitter.call(this);

  this.provider = provider;
  this._queues = [];
}
util.inherits(NativeConnection, EventEmitter);
NativeConnection.createConnection = NativeConnection;

// XXX(sam) optional, but it shouldn't be
NativeConnection.prototype.open = function() {
  var self = this;
  return self;
};

// XXX(sam) optional, but it shouldn't be
NativeConnection.prototype.close = function (callback) {
  var self = this;

  self._queues.forEach(function (queue) {
    queue.close();
  });
  self._queues = [];

  if (callback) {
    process.nextTick(callback);
  }

  return self;
};

// XXX(sam) refactor below to reduce cut-n-paste
NativeConnection.prototype.createPushQueue = cluster.isMaster ? masterCreatePushQueue : workerCreatePushQueue;
function masterCreatePushQueue(name) {
  var queue = NativePushQueue.createQueue({
    name: name,
    queue: broker.getWorkQueue(name)
  });
  this._queues.push(queue);
  return queue;
}
function workerCreatePushQueue(name) {
  return NativePushQueue.createQueue({
    name: name
  });
}

NativeConnection.prototype.createPullQueue = cluster.isMaster ? masterCreatePullQueue : workerCreatePullQueue;
function masterCreatePullQueue(name) {
  var queue = NativePullQueue.createQueue({
    name: name,
    queue: broker.getWorkQueue(name)
  });
  this._queues.push(queue);
  return queue;
}
function workerCreatePullQueue(name) {
  return NativePullQueue.createQueue({
    name: name
  });
}

NativeConnection.prototype.createPubQueue = cluster.isMaster ? masterCreatePublishQueue : workerCreatePublishQueue;
function masterCreatePublishQueue(name) {
  var queue = NativePublishQueue.createQueue({
    name: name,
    queue: broker.getTopicQueue(name)
  });
  this._queues.push(queue);
  return queue;
}
function workerCreatePublishQueue(name) {
  var self = this;

  return NativePublishQueue.createQueue({
    name: name
  });
}

NativeConnection.prototype.createSubQueue = cluster.isMaster ? masterCreateSubscribeQueue : workerCreateSubscribeQueue;
function masterCreateSubscribeQueue(name) {
  var queue = NativeSubscribeQueue.createQueue({
    name: name,
    queue: broker.getTopicQueue(name)
  });
  this._queues.push(queue);
  return queue;
}
function workerCreateSubscribeQueue(name) {
  var self = this;

  return NativeSubscribeQueue.createQueue({
    name: name
  });
}

module.exports = NativeConnection;
