var assert = require('assert');
var async = require('async');
var cmq = require('../');

if (false) {
  var dbg = console.log;
} else {
  var dbg = function () {};
}

var AMQP = {provider:'amqp'};

describe('the api', function () {
  it('should create amqp connector', function () {
    var mq = cmq.create(AMQP);
    assert.equal(mq.provider, 'amqp');
  });

  it('should throw on invalid inputs', function () {
    assert.throws(function () {
      cmq.create();
    });
    assert.throws(function () {
      cmq.create({});
    });
    assert.throws(function () {
      cmq.create({provider:'no such provider'});
    });
  });
});


describe('amqp connections', function () {
  function openAndClose(options, done) {
    var mq = cmq.create(options);
    mq.open(function () {
      mq.close(function () { done(); });
    }).on('error', done);
  }

  it('should open and close with localhost url', function (done) {
    openAndClose('amqp://localhost', done);
  });

  it('should open and close with default options', function (done) {
    openAndClose(AMQP, done);
  });

  it('should error on a connect failure', function (done) {
    var mq = cmq.create({provider:'amqp', port:1});
    mq.open(function () {
      assert(false); // unreachable on failure
    }).on('error', function (er) {
      assert(er);
      done();
    });
  });

  it('should throw on multiple open', function (done) {
    var mq = cmq.create(AMQP);
    mq.open(function (er) {
      assert(!er);
      assert.throws(function () {
        mq.open();
      });
      done();
    });
  });

  it.skip('should throw on close when never opened', function () {
    var mq = cmq.create(AMQP);
    assert.throws(function () {
      mq.close();
    });
  });

  it.skip('should throw on close after closed', function (done) {
    var mq = cmq.create(AMQP);
    mq.open(function (er) {
      mq.close(done);
      assert.throws(function () {
        mq.close();
      });
    });
  });

});


describe('amqp work queues', function () {
  var mq;

  beforeEach(function (done) {
    mq = cmq.create(AMQP);
    mq.open(done);
  });

  afterEach(function (done) {
    if(mq) {
      mq.close(done);
    }
  });

  it('should open and close a push queue', function (done) {
    var pushQueue = mq.pushQueue('june', function (er) {
      if (er) return done(er);
      pushQueue.close();
      done();
    });
  });

  it('should open and wait for close of a push queue', function (done) {
    var pushQueue = mq.pushQueue('june', function (er) {
      if (er) return done(er);
      pushQueue.close(done);
    });
  });

  it('should open and close a pull queue', function (done) {
    var pullQueue = mq.pullQueue('june', function (er) {
      if (er) return done(er);
      pullQueue.close();
      done();
    });
  });

  it('should open and wait for close of a pull queue', function (done) {
    var pullQueue = mq.pullQueue('june', function (er) {
      if (er) return done(er);
      pullQueue.close(done);
    });
  });

  it('should throw on close after close', function (done) {
    var pullQueue = mq.pullQueue('june', function (er) {
      if (er) return done(er);
      pullQueue.close(done);
      assert.throws(function () {
        pullQueue.close();
      });
    });
  });

  it('should forward underlying errors', function (done) {
    var pullQueue = mq.pullQueue('june', function (er) {
      if(er) return done(er);

      pullQueue.once('error', function (er) {
        assert(er === 'DIE');
        done();
      });
      pullQueue._q.emit('error', 'DIE');
    });
  });

});

var connectAndOpen = function (options, qtype, qname, callback) {
  var mq = cmq.create(options);

  mq.open(function (er) {
    if (er) return callback(er);

    mq.on('error', function (er) {
      dbg('ON connection', er);
    });

    var queue = mq[qtype].call(mq, qname, function (er) {
      if (er) {
        dbg('CB queue open', qtype, qname, er);
        mq.close(function (er2) {
          if (er2) {
            dbg('CB connection close', qtype, qname, er2);
          }
          return callback(er);
        });
      }

      callback(er, {connection: mq, queue: queue});
    });
    queue.on('error', function (er) {
      dbg('ON queue', er);
    });

  });
};

var closeAndDisconnect = function (queue, connection, callback) {
  dbg('queue close', queue.type, queue.name);
    connection.close(function () {
      dbg('connection closed');
      callback();
    });
};

describe('push and pull into work queues', function () {
  var mq;

  beforeEach(function (done) {
    async.parallel({
      push: function (callback) {
        connectAndOpen(AMQP, 'pushQueue', 'leonie', callback);
      },
      pull: function (callback) {
        connectAndOpen(AMQP, 'pullQueue', 'leonie', callback);
      }
    }, function (er, results) {
      if (er) return done(er);
      mq = results;
      done();
    });
  });

  afterEach(function (done) {
    async.parallel([
      function (callback) { closeAndDisconnect(mq.push.queue, mq.push.connection, callback); },
      function (callback) { closeAndDisconnect(mq.pull.queue, mq.pull.connection, callback); }
    ], done);
  });

  it('should have the queues already open', function () {
    assert(mq.push.connection);
    assert(mq.push.queue.type === 'push');
    assert(mq.push.queue.name === 'leonie');
    assert(mq.pull.connection);
    assert(mq.pull.queue.type === 'pull');
    assert(mq.pull.queue.name === 'leonie');
  });

  it('should receive sent strings', function (done) {
    mq.push.queue.publish('bonjour!');
    mq.pull.queue.subscribe(function (msg) {
      assert(msg == 'bonjour!');
      done();
    });
  });

  it('should receive sent json', function (done) {
    mq.push.queue.publish({salutation:'bonjour!'});
    mq.pull.queue.subscribe(function (msg) {
      assert.deepEqual(msg, {salutation:'bonjour!'});
      done();
    });
  });

  it('should receive sent arrays', function (done) {
    mq.push.queue.publish(['salutation', 'bonjour!']);
    mq.pull.queue.subscribe(function (msg) {
      assert.deepEqual(msg, ['salutation', 'bonjour!']);
      done();
    });
  });

  it('should receive sent buffers, as strings', function (done) {
    mq.push.queue.publish(new Buffer('bonjour!'));
    mq.pull.queue.subscribe(function (msg) {
      assert.equal(msg, 'bonjour!');
      done();
    });
  });

});

