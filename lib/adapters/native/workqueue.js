//
// # WorkQueue
//
// TODO: Description.
//

//
// ## WorkQueue `WorkQueue(obj)`
//
// Creates a new instance of WorkQueue with the following options:
//
function WorkQueue(obj) {
  if (!(this instanceof WorkQueue)) {
    return new WorkQueue(obj)
  }

  obj = obj || {}

  this.work = []
  this.workers = []
  this.nextWorker = 0
}
WorkQueue.createQueue = WorkQueue

//
// ## push `push(task)`
//
// TODO: Description.
//
WorkQueue.prototype.push = push
function push(task) {
  var self = this

  if (self.workers.length) {
    // Round-robin amongst workers agnostic of worker Array size.
    self.workers[self.nextWorker = self.nextWorker % self.workers.length].send(task)
    self.nextWorker++
  } else {
    self.work.push(task)
  }

  return self
}

//
// ## flush `flush()`
//
// TODO: Description.
//
WorkQueue.prototype.flush = flush
function flush() {
  var self = this

  self.work.forEach(function (task) {
    self.push(task)
  })
  self.work = []

  return self
}

//
// ## pushWorker `pushWorker(worker)`
//
// TODO: Description.
//
WorkQueue.prototype.pushWorker = pushWorker
function pushWorker(worker) {
  var self = this

  self.workers.push(worker)
  self.flush()

  return self
}

//
// ## popWorker `popWorker(worker)`
//
// TODO: Description.
//
WorkQueue.prototype.popWorker = popWorker
function popWorker(worker) {
  var self = this
    , index = self.workers.indexOf(worker)

  if (index !== -1) {
    self.workers.splice(index, 1)
  }

  return self
}

module.exports = WorkQueue
