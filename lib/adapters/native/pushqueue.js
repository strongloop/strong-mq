//
// # NativePushQueue
//
var assert = require('assert');
var cluster = require('cluster');

//
// ## NativePushQueue `NativePushQueue(obj)`
//
// Creates a new instance of NativePushQueue with the following options:
//
function NativePushQueue(obj) {
  if (!(this instanceof NativePushQueue)) {
    return new NativePushQueue(obj);
  }

  obj = obj || {};

  this.name = obj.name || '';
  this.type = 'push';
  this.queue = obj.queue || null;
}
NativePushQueue.createQueue = NativePushQueue;

//
// ## publish `publish(msg)`
//
// TODO: Description.
//
NativePushQueue.prototype.publish = cluster.isMaster ? masterPublish : workerPublish;
function masterPublish(msg) {
  var self = this;

  assert(self.queue, 'No underlying queue was created.');

  self.queue.push({
    name: self.name,
    type: 'push',
    msg: msg
  });

  return self;
}
function workerPublish(msg) {
  var self = this;

  process.send({
    name: self.name,
    type: 'pushreq',
    msg: msg
  });

  return self;
}


NativePushQueue.prototype.close = function() {
};


module.exports = NativePushQueue;
