//
// # NativePullQueue
//
// TODO: Description.
//
var cluster = require('cluster');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

//
// ## NativePullQueue `NativePullQueue(obj)`
//
// Creates a new instance of NativePullQueue with the following options:
//
function NativePullQueue(obj) {
  if (!(this instanceof NativePullQueue)) {
    return new NativePullQueue(obj);
  }

  EventEmitter.call(this);

  obj = obj || {};

  this.name = obj.name || '';
  this.type = 'pull';
  this.queue = obj.queue || null;

  this._init();
}
util.inherits(NativePullQueue, EventEmitter);
NativePullQueue.createQueue = NativePullQueue;

//
// ## subscribe `subscribe([handler])`
//
// If provided, **handler** will be added as a `'message'` event listener for this queue.
//
// XXX(sam) subscribe should be mandatory
NativePullQueue.prototype.subscribe = subscribe;
function subscribe(handler) {
  var self = this;

  self.on('message', handler);

  return self;
}

NativePullQueue.prototype.close = cluster.isMaster ? masterClose : workerClose;
function masterClose() {
  var self = this;
  self.queue.popWorker(self);
  return self;
}
function workerClose() {
  var self = this;
  process.send({
    type: 'stoppull',
    name: self.name
  });
  process.removeListener('message', self._receive);
  return self;
}


//
// ## _init `_init()`
//
// Internal use only.
//
// Establishes internal state, event handlers, etc.
//
// XXX(sam) registration should happen in subscribe, so it is not optional
// XXX(sam) if a worker has two pull queues, with same name, then BOTH will get the msg
NativePullQueue.prototype._init = cluster.isMaster ? masterInit : workerInit;
function masterInit() {
  var self = this;

  if (!self.queue) {
    // This will only happen if NativePullQueue is used externally and improperly.
    throw new Error('No underlying queue was created.');
  }

  self.send = function(data) {
    self.emit('message', data.msg);
  };

  self.queue.pushWorker(self);

  return self;
}
function workerInit() {
  var self = this;

  self._receive = function(data) {
    if (data.name === self.name && data.type === 'push') {
      self.emit('message', data.msg);
    }
  };

  process.on('message', self._receive);

  process.send({
    type: 'startpull',
    name: self.name
  });

  return self;
}

module.exports = NativePullQueue;
