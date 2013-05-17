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
function masterPublish(msg, topic) {
  var self = this;

  assert(valid(topic));

  self.queue.publish(msg, topic);

  return self;
}
function workerPublish(msg, topic) {
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

NativePublishQueue.prototype.close = function() {
};


module.exports = NativePublishQueue;
