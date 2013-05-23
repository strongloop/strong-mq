//
// # WorkQueue
//
// TODO: Description.
//

var dbg = require('../../dbg');

//
// ## WorkQueue `WorkQueue(obj)`
//
// Creates a new instance of WorkQueue with the following options:
//
function WorkQueue(obj) {
  if (!(this instanceof WorkQueue)) {
    return new WorkQueue(obj);
  }

  obj = obj || {};

  this.work = [];
  this.workers = [];
  this.nextWorker = 0;
}
WorkQueue.createQueue = WorkQueue;

//
// ## push `push(task)`
//
// TODO: Description.
//
WorkQueue.prototype.push = push;
function push(task) {
  var self = this;

  if (self.workers.length) {
    // Round-robin amongst workers agnostic of worker Array size, which can
    // change on the fly as workers come and go.
    self.nextWorker = self.nextWorker % self.workers.length;
    self.workers[self.nextWorker].send(task);
    self.nextWorker++;
  } else {
    self.work.push(task);
  }

  return self;
}

//
// ## flush `flush()`
//
// TODO: Description.
//
WorkQueue.prototype.flush = flush;
function flush() {
  var self = this;
  var work = self.work;

  // Avoid re-pushing if we know there are no workers to receive
  if (!self.workers.length) {
    return self;
  }

  self.work = [];

  work.forEach(function(task) {
    self.push(task);
  });

  return self;
}

//
// ## pushWorker `pushWorker(worker)`
//
// TODO: Description.
//
WorkQueue.prototype.pushWorker = pushWorker;
function pushWorker(worker) {
  var self = this;

  self.workers.push(worker);

  // Allow subscribe to return before pushing any-preexisting tasks
  process.nextTick(function() {
    self.flush();
  });

  return self;
}

//
// ## popWorker `popWorker(worker)`
//
// TODO: Description.
//
WorkQueue.prototype.popWorker = popWorker;
function popWorker(worker) {
  var self = this;
  var index = self.workers.indexOf(worker);

  if (index !== -1) {
    self.workers.splice(index, 1);
  }

  return self;
}

module.exports = WorkQueue;
