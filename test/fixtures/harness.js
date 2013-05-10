//
// This "harness" is responsible for running a small cluster of processes that send events to one another, finally
// recording the results to the file system.
//
var cluster = require('cluster');
var manager = require('./manager').createManager(process.env);
var WORKERS = 2;

//
// There are seven tests per process with four messages sent per test. With 2 workers, the total number of messages that
// should be recorded will be 84. Each process:
//
//  1. Sends messages to itself over push/pull where the PushQueue was created first.
//  2. Sends messages to itself over push/pull where the PullQueue was created first.
//  3. Sends messages to master over push/pull.
//  4. Sends messages to worker0 over push/pull.
//  5. Sends messages to worker1 over push/pull.
//  6. Sends messages to both workers over push/pull.
//  7. Sends messages to all processes over push/pull.
//
manager
  .init(WORKERS)
  .runTestPush(process.env.id + '.pushfirst')
  .runTestPull(process.env.id + '.pushfirst')
  .runTestPull(process.env.id + '.pullfirst')
  .runTestPush(process.env.id + '.pullfirst')
  .runTestPush('master.work')
  .runTestPush('worker0.work')
  .runTestPush('worker1.work')
  .runTestPull(process.env.id + '.work')
  .runTestPull('all.work');

//
// We delay the "balanced" tests to give other processes time to start up to test the ideal case.
//
setTimeout(function () {
  manager
    .runTestPush('workers.work')
    .runTestPush('all.work');
}, 500);

//
// Not only do only workers subscribe to the workers.work queue, but workers should be shut down after a reasonable
// amount of time has been allotted for the tests themselves.
//
if (cluster.isWorker) {
  manager
    .runTestPull('workers.work');

  setTimeout(process.exit, 1000);
}
