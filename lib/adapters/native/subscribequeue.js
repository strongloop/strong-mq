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
  this._onPublish = [];
  this._onMessage = [];
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

  function onPublish(data) {
    if (regexp.test(data.topic)) {
      self.emit('message', data.msg);
    }
  };

  self._onPublish.push(onPublish);
  self.queue.on('publish', onPublish);

  if (handler) {
    self.on('message', handler);
  }

  return self;
}
function workerSubscribe(pattern, handler) {
  var self = this;
  var regexp = matcher(pattern);

  function onMessage(data) {
    if (data.name === self.name && data.type === 'publish' &&
        regexp.test(data.topic)) {
      self.emit('message', data.msg);
    }
  };

  self._onMessage.push(onMessage);
  process.on('message', onMessage);

  if (handler) {
    self.on('message', handler);
  }

  return self;
}

function removeListeners(emitter, event, listeners) {
  callbacks.forEach(function(callback) {
    emitter.removeListener(event, callback);
  });
}

NativeSubscribeQueue.prototype.close = cluster.isMaster ? masterClose : workerClose;
function masterClose() {
  var self = this;
  self._onPublish.forEach(self.queue.removeListener.bind(self.queue, 'publish'));
  self._onPublish = [];
  return self;
}
function workerClose() {
  var self = this;
  self._onMessage.forEach(process.removeListener.bind(process, 'message'));
  self._onMessage = [];
  return self;
}


module.exports = NativeSubscribeQueue;
