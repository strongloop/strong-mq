var assert = require('assert');
var async = require('async');
var dbg = require('../lib/dbg');
var slmq = require('../');


var AMQP = {provider: 'amqp'};


describe('open with amqp', function() {
  it('should error on a connect failure', function(done) {
    var mq = slmq.create({provider: 'amqp', port: 1});
    mq.NAME = 'FIRST';
    mq.open(function() {
      assert(false); // unreachable on failure
    }).on('error', function(er) {
      dbg('on err', mq.NAME, er);
      assert(er);
      done();
    });
  });
});


// Less necessary now that operations are serialized.
var connectAndOpen = function(options, qtype, qname, callback) {
  var mq = slmq.create(options).open();
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

  // XXX(sam) tests now duplicate with ones in test/generic.js, remove soon

  beforeEach(function(done) {
    async.parallel({
      push: function(callback) {
        connectAndOpen(AMQP, 'createPushQueue', 'leonie', callback);
      },
      pull: function(callback) {
        connectAndOpen(AMQP, 'createPullQueue', 'leonie', callback);
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
      dbg('tst unprocessed?', mq.push.connection._slmq.whenReady.tasks);
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

  it('should receive sent buffers', function(done) {
    mq.push.queue.publish(new Buffer('bonjour!'));
    mq.pull.queue.subscribe(function(msg) {
      assert.equal(msg, 'bonjour!');
      done();
    });
  });

});


describe('pub/sub', function() {
  it('should open and close', function(done) {
    async.series([
      function(callback) {
        connectAndOpen(AMQP, 'createPubQueue', 'leonie', callback);
      },
      function(callback) {
        connectAndOpen(AMQP, 'createSubQueue', 'leonie', callback);
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

    conn = slmq.create(AMQP).open();
    queue = conn.createPubQueue('leonie');
    var pub = {connection: conn, queue: queue};

    conn = slmq.create(AMQP).open();
    queue = conn.createSubQueue('leonie');
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
