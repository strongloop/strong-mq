// This "harness" is responsible for running a small cluster of processes that
// send events to one another, finally recording the results to the file
// system. While it runs the tests, it does not assert anything about the
// results, that is left to the caller.
//
var cluster = require('cluster');
var manager = require('./manager').createManager(process.env);
var WORKERS = 2;

/*
There are 17 tests per process with four messages sent per test. With 2
workers, the total number of messages that should be recorded will be 84
push/pull and 156 pub/sub, for 240 total. Each process:

1. Sends messages to itself over push/pull where the PushQueue was created first
2. Sends messages to itself over push/pull where the PullQueue was created first
3. Sends messages to master over push/pull
4. Sends messages to worker0 over push/pull
5. Sends messages to worker1 over push/pull
6. Sends messages to both workers over push/pull
7. Sends messages to all processes over push/pull
8. Sends messages to master over pub/sub with a generic topic
9. Sends messages to worker0 over pub/sub with a generic topic
10. Sends messages to worker1 over pub/sub with a generic topic
11. Sends messages to both workers over pub/sub with a generic topic
12. Sends messages to all processes over pub/sub with a generic topic
13. Sends messages to both workers over pub/sub with a worker0-specific topic
14. Sends messages to both workers over pub/sub with a worker1-specific topic
15. Sends messages to all processes over pub/sub with a master-specific topic
16. Sends messages to all processes over pub/sub with a worker0-specific topic
17. Sends messages to all processes over pub/sub with a worker1-specific topic
*/
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

manager
  .runTestSubscribe(process.env.id + '.topic', 'test')
  .runTestSubscribe('all.topic', 'test')
  .runTestSubscribe('all.topic', process.env.id);

// Note: Race conditions ahead. in the absence of explicit synchronization about
// test start-stop, we use timeouts. Publishers need to wait until subscribers
// are ready, and subscribers need to wait until all messages have been
// received. This is a bit finicky, because timing depends on the system.
setTimeout(function () {
  manager
    .runTestPush('workers.work')
    .runTestPush('all.work')
    .runTestPublish('master.topic', 'test')
    .runTestPublish('worker0.topic', 'test')
    .runTestPublish('worker1.topic', 'test')
    .runTestPublish('workers.topic', 'test')
    .runTestPublish('all.topic', 'test')
    .runTestPublish('all.topic', 'master')
    .runTestPublish('all.topic', 'worker0')
    .runTestPublish('all.topic', 'worker1')
    .runTestPublish('workers.topic', 'worker0')
    .runTestPublish('workers.topic', 'worker1');
}, 2000);

//
// Not only do only workers subscribe to the workers.work queue, but workers
// should be shut down after a reasonable amount of time has been allotted for
// the tests themselves.
//
if (cluster.isWorker) {
  manager
    .runTestPull('workers.work')
    .runTestSubscribe('workers.topic', 'test')
    .runTestSubscribe('workers.topic', process.env.id);

  setTimeout(process.exit, 5000);
} else {
  // Close the connection, allowing harness to exit after its workers
  setTimeout(function() {
    manager.connection.close();
  }, 6000);
}
