// Jobs: job flow control
var async = require('async');

exports.delayed = delayed;

// d = jobs.delayed([drained])
//
// call drained every time all jobs are done
//
// d.push(job)
//
// job is function(done), it should call done() when complete
//
// d.start()
//
// start processing queue
function delayed(drained) {
  var self = async.queue(function(task, callback) {
    task(callback);
  }, 0);
  self.start = function() {
    self.concurrency = 1;
    // Make async notice that concurrency has changed.
    self.push(function primer(done) {
      done();
    });
    return self;
  };
  self.drain = drained;
  return self;
}

