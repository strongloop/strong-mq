//
// # NativeSubscribeQueue
//
var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var cluster = require('cluster');
var util = require('util');
var matcher = require('../../topic').matcher;

//
// ## NativeSubscribeQueue `NativeSubscribeQueue(obj)`
//
// Creates a new instance of NativeSubscribeQueue with the following options:
//
function NativeSubscribeQueue(obj) {
  if (!(this instanceof NativeSubscribeQueue)) {
    return new NativeSubscribeQueue(obj);
  }

  EventEmitter.call(this);

  obj = obj || {};

  this.name = obj.name;
  this.type = 'sub';
  this.queue = obj.queue || null;
}
util.inherits(NativeSubscribeQueue, EventEmitter);
NativeSubscribeQueue.createQueue = NativeSubscribeQueue;

//
// ## subscribe `subscribe(pattern, [handler])`
//
// Subscribes to **pattern**, increasing the types of `message` events emitted.
// If provided, **handler** will be added as a `'message'` event listener for
// this queue.
//
NativeSubscribeQueue.prototype.subscribe = cluster.isMaster ? masterSubscribe : workerSubscribe;
function masterSubscribe(pattern, handler) {
  var self = this;
  var regexp = matcher(pattern);

  assert(self.queue, 'No underlying queue was created');

  self._onPublish = function(data) {
    if (regexp.test(data.topic)) {
      self.emit('message', data.msg);
    }
  };

  self.queue.on('publish', self._onPublish);

  if (handler) {
    self.on('message', handler);
  }

  return self;
}
function workerSubscribe(pattern, handler) {
  var self = this;
  var regexp = matcher(pattern);

  self._onMessage = function(data) {
    if (data.name === self.name && data.type === 'publish' &&
        regexp.test(data.topic)) {
      self.emit('message', data.msg);
    }
  };

  process.on('message', self._onMessage);

  self.on('message', handler);

  return self;
}

NativeSubscribeQueue.prototype.close = cluster.isMaster ? masterClose : workerClose;
function masterClose() {
  var self = this;
  if (self._onPublish) {
    self.queue.removeListener('publish', self._onPublish);
  }
  return self;
}
function workerClose() {
  var self = this;
  if (self._onMessage) {
    process.removeListener('message', self._onMessage);
  }
  return self;
}


module.exports = NativeSubscribeQueue;
