// cluster master broker
//
// This 'broker' lives in a cluster master, attaches to its fork and disconnect
// events, and keeps track of the queues, and the connections to them. Those
// connections and users of the queues can either be child workers, or
// connections created in the master (a situation more typical during unit
// testing).

var assert = require('assert');
var cluster = require('cluster');
var EventEmitter = require('events').EventEmitter;
var WorkQueue = require('./workqueue');
var VERSION = require('../../../package.json').version;

// Only initialize a broker in the master
if (cluster.isMaster) {
  assert(!cluster._strongMqNative, 'Multiple instantiation detected!');

  exports._init = _init;
  exports._final = _final;
  exports._init();
}


function _init() {
  var self = this;

  self._topicQueues = {};
  self._workQueues = {};

  // For each worker that is created, listen to its messages.
  self._onFork = function onFork(worker) {
    worker.on('message', function(data) {
      switch (data.type) {
        case 'publishreq':
          self.getTopicQueue(data.name).publish(data.msg, data.topic);
          break;
        case 'startpull':
          self.getWorkQueue(data.name).pushWorker(worker);
          break;
        case 'stoppull':
          self.getWorkQueue(data.name).popWorker(worker);
          break;
        case 'pushreq':
          data.type = 'push';
          self.getWorkQueue(data.name).push(data);
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

  self._final = _final;
  self.getWorkQueue = getWorkQueue;
  self.getTopicQueue = getTopicQueue;
}

// Not normally called, but we might need something like it in tests
// to reset state back to initial.
function _final() {
  var self = this;

  cluster.removeListener('fork', self._onFork);
  cluster.removeListener('disconnect', self._onDisconnect);
}

//
// ## _getWorkQueue `_getWorkQueue(name)`
//
// Internal use only.
//
// Returns the WorkQueue named **name**, creating one if it doesn't already
// exist.
//
function getWorkQueue(name) {
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
// Returns the TopicQueue named **name**, creating one if it doesn't already
// exist.
//
function getTopicQueue(name) {
  var self = this;
  var queue = self._topicQueues[name];

  if (!queue) {
    // XXX(sam) topic queues should know subscribers and their topics
    queue = self._topicQueues[name] = new EventEmitter();
    queue.publish = function(msg, topic) {
      // XXX(sam) sends to all workers, should only send to ones who subscribe
      // XXX(sam) send same obj to all workers, instead of recreating
      Object.keys(cluster.workers).forEach(function(id) {
        cluster.workers[id].send({
          name: name,
          type: 'publish',
          topic: String(topic),
          msg: msg
        });
      });

      queue.emit('publish', {
        topic: String(topic), // XXX(sam) why String?
        msg: msg
      });
    };
  }

  return queue;
}
