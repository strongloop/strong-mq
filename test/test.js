var assert = require('assert');
var async = require('async');
var os = require('os');
var path = require('path');
var fork = require('child_process').fork;
var cmq = require('../');
var Manager = require('./fixtures/manager');

var dbg;
if (process.env.NODE_CLUSTERMQ_DEBUG) {
  dbg = console.log;
} else {
  dbg = function() {};
}

var AMQP = {provider: 'amqp'};

describe('the api', function() {
  it('should create amqp connector', function() {
    var mq = cmq.create(AMQP);
    assert.equal(mq.provider, 'amqp');
  });

  it('should throw on invalid inputs', function() {
    assert.throws(function() {
      cmq.create();
    });
    assert.throws(function() {
      cmq.create({});
    });
    assert.throws(function() {
      cmq.create({provider: 'no such provider'});
    });
  });
});


describe('amqp connections', function() {
  function openAndClose(options, done) {
    cmq.create(options)
      .open()
      .close(function() {
        // after error, the socket will be closed, don't call done() twice
        if (done) {
          done();
        }})
      .once('error', function(er) {
        if (er.code === ECONNRESET) {
          // Some rabbitmq servers don't like to have the connection
          // just opened and closed.
          er = null;
        }
        done(er);
        done = null;
      });
    /*
    var mq = cmq.create(options);
    mq.open(function() {
      mq.close(function() { done(); });
    }).on('error', done);
    */
  }

  it('should wait until rabbitmq is up on ec-2', function(done) {
    this.timeout(5000);
    setTimeout(done, 4000);
  });

  it('should open and close with localhost url', function(done) {
    openAndClose('amqp://localhost', done);
  });

  it('should open and close with default options', function(done) {
    openAndClose(AMQP, done);
  });

  it('should error on a connect failure', function(done) {
    var mq = cmq.create({provider: 'amqp', port: 1});
    mq.NAME = 'FIRST';
    mq.open(function() {
      assert(false); // unreachable on failure
    }).on('error', function(er) {
      dbg('on err', mq.NAME, er);
      assert(er);
      done();
    });
  });

  // XXX(sam) next are difficult, we are victim of underlying lib, I wanted
  // them because its nice to detect usage errors immediately, rather than just
  // damaging the connection which shows up later.
  it.skip('should throw or ignore multiple open', function(done) {
  });

  it.skip('should throw or ignore close when never opened', function() {
  });

  it.skip('should throw on close after closed', function(done) {
  });

});


describe('amqp work queues', function() {
  it('should open and close a push queue', function(done) {
    var mq = cmq.create(AMQP).open();
    assert(mq.pushQueue('june'));
    mq.close(done);
  });

  it('should open and close a push queue, with on', function(done) {
    var mq = cmq.create(AMQP).open();
    assert(mq.pushQueue('june'));
    mq.close().on('close', function() { done(); }); // strip net's argument to close
  });

  it('should open and close a pull queue', function(done) {
    var mq = cmq.create(AMQP).open();
    assert(mq.pullQueue('june'));
    mq.close(done);
  });

  it('should open and close a pull queue, with on', function(done) {
    var mq = cmq.create(AMQP).open();
    assert(mq.pullQueue('june'));
    mq.close().on('close', function() { done(); }); // strip net's argument to close
  });

  // XXX(sam) Difficult, see comments above.
  it.skip('should throw on close after close', function(done) {
  });

  // XXX(sam) how to cause underlying errors?
  it.skip('should forward underlying errors', function(done) {
  });

});

// Less necessary now that operations are serialized.
var connectAndOpen = function(options, qtype, qname, callback) {
  var mq = cmq.create(options).open();
  var queue = mq[qtype].call(mq, qname);
  callback(null, {connection: mq, queue: queue});
};

var closeAndDisconnect = function(queue, connection, callback) {
  dbg('tst queue close', queue.type, queue.name);
  connection.close(function() {
    dbg('connection closed');
    callback();
  });
};

describe('push and pull into work queues', function() {
  var mq;

  beforeEach(function(done) {
    async.parallel({
      push: function(callback) {
        connectAndOpen(AMQP, 'pushQueue', 'leonie', callback);
      },
      pull: function(callback) {
        connectAndOpen(AMQP, 'pullQueue', 'leonie', callback);
      }
    }, function(er, results) {
      if (er) return done(er);
      mq = results;
      done();
    });
  });

  afterEach(function(done) {
    dbg('after-each');
    async.parallel([
      function(callback) {
        closeAndDisconnect(mq.push.queue, mq.push.connection, callback); },
      function(callback) {
        closeAndDisconnect(mq.pull.queue, mq.pull.connection, callback); }
    ], done);
  });

  it('should have the queues already open', function() {
    assert(mq.push.connection);
    assert(mq.push.queue.type === 'push');
    assert(mq.push.queue.name === 'leonie');
    assert(mq.pull.connection);
    assert(mq.pull.queue.type === 'pull');
    assert(mq.pull.queue.name === 'leonie');
  });

  it('should receive sent strings', function(done) {
    mq.push.queue.publish('bonjour!');
    mq.pull.queue.subscribe(function(msg) {
      dbg('tst receive', msg.toString());
      dbg('tst unprocessed?', mq.push.connection._cmq.whenReady.tasks);
      assert(msg == 'bonjour!');
      done();
    });
  });

  it('should receive sent json', function(done) {
    mq.push.queue.publish({salutation: 'bonjour!'});
    mq.pull.queue.subscribe(function(msg) {
      assert.deepEqual(msg, {salutation: 'bonjour!'});
      done();
    });
  });

  it('should receive sent arrays', function(done) {
    mq.push.queue.publish(['salutation', 'bonjour!']);
    mq.pull.queue.subscribe(function(msg) {
      assert.deepEqual(msg, ['salutation', 'bonjour!']);
      done();
    });
  });

  it('should receive sent buffers, as strings', function(done) {
    mq.push.queue.publish(new Buffer('bonjour!'));
    mq.pull.queue.subscribe(function(msg) {
      // XXX actually, sent buffers AND strings are received as buffers, which
      // test as equal to strings
      assert.equal(msg, 'bonjour!');
      done();
    });
  });

});

describe('pub/sub', function() {
  it('should open and close', function(done) {
    async.series([
      function(callback) {
        connectAndOpen(AMQP, 'pubQueue', 'leonie', callback);
      },
      function(callback) {
        connectAndOpen(AMQP, 'subQueue', 'leonie', callback);
      }
    ], function(er, results) {
      if (er) return done(er);
      var pub = results[0];
      var sub = results[1];
      assert(pub.queue.type == 'pub');
      assert(sub.queue.type == 'sub');
      async.series([
        function(callback) {
          closeAndDisconnect(pub.queue, pub.connection, callback); },
        function(callback) {
          closeAndDisconnect(sub.queue, sub.connection, callback); }
      ], done);
    });
  });

  it('should publish and subscribe', function(done) {
    dbg('tst start pub and sub');
    var conn, queue;

    conn = cmq.create(AMQP).open();
    queue = conn.pubQueue('leonie');
    var pub = {connection: conn, queue: queue};

    conn = cmq.create(AMQP).open();
    queue = conn.subQueue('leonie');
    var sub = {connection: conn, queue: queue};

    dbg('tst opened pub and sub');

    sub.queue.subscribe('some', function(msg) {
      dbg('tst received from sub');
      assert(msg == 'quelle affaire');
      async.series([
        function(callback) {
          closeAndDisconnect(pub.queue, pub.connection, callback);
        },
        function(callback) {
          closeAndDisconnect(sub.queue, sub.connection, callback);
        }
      ], done);
    });

    // Need to resolve race condition in above code, publish is dropped
    // when there are no subscribers, so wait for underlying sub queue
    // to be bound before publishing.
    // XXX(sam) Is there a better way?
    sub.connection._doWhenReady(function waitForSubBeforePub(done) {
      dbg('tst publishing to pub');
      pub.queue.publish('quelle affaire', 'some.thing');
      done();
      dbg('tst waiting for sub recv');
    });
  });
});

describe('native driver', function () {
  before(function (done) {
    var filename = path.join(os.tmpDir(), 'clustermq-native-test');
    var manager = Manager.createManager({
      provider: 'native',
      filename: filename
    });
    var results = this.results = {
      length: 0
    };

    fork(require.resolve('./fixtures/harness'), [], {
      env: {
        provider: 'native',
        filename: filename
      }
    }).on('exit', function () {
      manager.loadTestResults().forEach(function (line) {
        var split = line.split(':');

        assert.equal(split.length, 3, 'Malformed message: ' + line);

        results[split[0]] = results[split[0]] || {};
        results[split[0]][split[1]] = results[split[0]][split[1]] || [];
        results[split[0]][split[1]].push(split[2]);
        results.length++;
      });

      done();
    });

    this.checkMessageArray = function checkMessageArray(recipient, name, length) {
      var array = results[recipient.toLowerCase()][name];
      assert(array, recipient + ' did not receive "' + name + '" messages.');

      var delta = length - array.length;
      assert.equal(delta, 0, delta + '"' + name + '" messages were dropped heading to ' + recipient + '.');
    };
  });

  it('should send all messages', function () {
    assert.equal(this.results.length, 240, (this.results.length - 240) + ' messages were dropped.');
  });

  it('should send messages to all processes', function () {
    assert(this.results.master, 'Master did not receive messages');
    assert(this.results.worker0, 'Worker0 did not receive messages');
    assert(this.results.worker1, 'Worker1 did not receive messages');
  });

  it('should filter work queues by name', function () {
    this.checkMessageArray('Master', 'master.work', 12);
    this.checkMessageArray('Master', 'all.work', 4);

    this.checkMessageArray('Worker0', 'worker0.work', 12);
    this.checkMessageArray('Worker0', 'workers.work', 6);
    this.checkMessageArray('Worker0', 'all.work', 4);

    this.checkMessageArray('Worker1', 'worker1.work', 12);
    this.checkMessageArray('Worker1', 'workers.work', 6);
    this.checkMessageArray('Worker1', 'all.work', 4);
  });

  it('should support PushQueue first or PullQueue first', function () {
    this.checkMessageArray('Master', 'master.pushfirst', 4);
    this.checkMessageArray('Master', 'master.pullfirst', 4);

    this.checkMessageArray('Worker0', 'worker0.pushfirst', 4);
    this.checkMessageArray('Worker0', 'worker0.pullfirst', 4);

    this.checkMessageArray('Worker1', 'worker1.pushfirst', 4);
    this.checkMessageArray('Worker1', 'worker1.pullfirst', 4);
  });

  it('should filter topic queues by name', function () {
    this.checkMessageArray('Master', 'master.topic.test', 12);
    this.checkMessageArray('Worker0', 'worker0.topic.test', 12);
    this.checkMessageArray('Worker1', 'worker1.topic.test', 12);

    this.checkMessageArray('Worker0', 'workers.topic.test', 12);
    this.checkMessageArray('Worker1', 'workers.topic.test', 12);

    this.checkMessageArray('Master', 'all.topic.test', 12);
    this.checkMessageArray('Worker0', 'all.topic.test', 12);
    this.checkMessageArray('Worker1', 'all.topic.test', 12);
  });

  it('should filter subscriptions by topic', function () {
    this.checkMessageArray('Master', 'all.topic.master', 12);
    this.checkMessageArray('Worker0', 'all.topic.worker0', 12);
    this.checkMessageArray('Worker1', 'all.topic.worker1', 12);

    this.checkMessageArray('Worker0', 'workers.topic.worker0', 12);
    this.checkMessageArray('Worker1', 'workers.topic.worker1', 12);
  });
});
