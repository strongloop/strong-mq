//
// # NativePublishQueue
//
// TODO: Description.
//

var assert = require('assert');
var cluster = require('cluster');
var valid = require('../../topic').valid;

//
// ## NativePublishQueue `NativePublishQueue(obj)`
//
// Creates a new instance of NativePublishQueue with the following options:
//
function NativePublishQueue(obj) {
  if (!(this instanceof NativePublishQueue)) {
    return new NativePublishQueue(obj);
  }

  obj = obj || {};

  this.name = obj.name;
  this.type = 'pub';
  this.queue = obj.queue || null;
}
NativePublishQueue.createQueue = NativePublishQueue;


NativePublishQueue.prototype.publish = cluster.isMaster ? masterPublish : workerPublish;
function masterPublish(topic, msg) {
  var self = this;

  assert(valid(topic));

  if (!self.queue) {
    // This will only happen if NativePublishQueue is used externally and improperly.
    throw new Error('No underlying queue was created.');
  }

  Object.keys(cluster.workers).forEach(function(id) {
    cluster.workers[id].send({
      name: self.name,
      type: 'publish',
      topic: String(topic),
      msg: msg
    });
  });

  self.queue.emit('publish', {
    topic: String(topic),
    msg: msg
  });

  return self;
}
function workerPublish(topic, msg) {
  var self = this;

  assert(valid(topic));

  process.send({
    name: self.name,
    type: 'publishreq',
    topic: String(topic),
    msg: msg
  });

  return self;
}

module.exports = NativePublishQueue;
