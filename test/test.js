var assert = require("assert");
var async = require("async");
var cmq = require("../");

if (false) {
  var dbg = console.log;
} else {
  var dbg = function () {};
}

var AMQP = {provider:'amqp'};

describe("declaration", function () {
  it("should declare amqp connector", function () {
    var mq = cmq.declare(AMQP);
    assert.equal(mq.provider, 'amqp');
  });

  it("should puke on invalid inputs", function () {
    assert.throws(function () {
      cmq.declare();
    });
    assert.throws(function () {
      cmq.declare({});
    });
    assert.throws(function () {
      cmq.declare({provider:'no such provider'});
    });
  });
});


describe("opening amqp", function () {
  it("should open and close with localhost url", function (done) {
    var mq = cmq.declare("amqp://localhost");
    mq.open(function (err) {
      if (err) return done(err);
      mq.close(done);
    });
  });

  it("should open and close with default options", function (done) {
    var mq = cmq.declare(AMQP);
    mq.open(function (err) {
      if (err) return done(err);
      mq.close(done);
    });
  });

  it("should callback with error on an invalid open", function (done) {
    var mq = cmq.declare({provider:'amqp', port:1});
    mq.open(function (err) {
      assert(err);
      done();
    });
  });

});



describe("open and close work queues", function () {
  var mq;

  beforeEach(function (done) {
    mq = cmq.declare(AMQP);
    mq.open(done);
  });

  afterEach(function (done) {
    mq.close(done);
  });

  it("should open and close a push queue", function (done) {
    var pushQueue = mq.pushQueue("june", function (err) {
      if (err) return done(err);
      pushQueue.close();
      done();
    });
  });

  it("should open and wait for close of a push queue", function (done) {
    var pushQueue = mq.pushQueue("june", function (err) {
      if (err) return done(err);
      pushQueue.close(done);
    });
  });

  it("should open and close a pull queue", function (done) {
    var pullQueue = mq.pullQueue("june", function (err) {
      if (err) return done(err);
      pullQueue.close();
      done();
    });
  });

  it("should open and wait for close of a pull queue", function (done) {
    var pullQueue = mq.pullQueue("june", function (err) {
      if (err) return done(err);
      pullQueue.close(done);
    });
  });

});

var connectAndOpen = function (options, qtype, qname, callback) {
  var mq = cmq.declare(options);

  mq.open(function (err) {
    if (err) return callback(err);

    mq.on('error', function (er) {
      dbg("ON connection", er);
    });

    var queue = mq[qtype].call(mq, qname, function (err) {
      if (err) {
        dbg("CB queue open", qtype, qname, err);
        mq.close(function (err2) {
          if (err2) {
            dbg("CB connection close", qtype, qname, err2);
          }
          return callback(err);
        });
      }

      callback(err, {connection: mq, queue: queue});
    });
    queue.on('error', function (er) {
      dbg("ON queue", er);
    });

  });
};

var closeAndDisconnect = function (queue, connection, callback) {
  dbg("queue close", queue.type, queue.name);
  queue.close(function () {
    dbg("connection close", queue.type, queue.name);
    connection.close(function () {
      dbg("connection closed");
      callback();
    });
  });
};

describe("push and pull into work queues", function () {
  var mq;

  beforeEach(function (done) {
    async.parallel({
      push: function (callback) {
        connectAndOpen(AMQP, "pushQueue", "leonie", callback);
      }
      , pull: function (callback) {
        connectAndOpen(AMQP, "pullQueue", "leonie", callback);
      }
    }, function (err, results) {
      if (err) return done(err);
      mq = results;
      done();
    });
  });

  afterEach(function (done) {
    async.parallel([
      function (callback) { closeAndDisconnect(mq.push.queue, mq.push.connection, callback); }
      ,
      function (callback) { closeAndDisconnect(mq.pull.queue, mq.pull.connection, callback); }
    ], done);
  });

  it("should have the queues already open", function () {
    assert(mq.push.connection);
    assert(mq.push.queue.type === "push");
    assert(mq.push.queue.name === "leonie");
    assert(mq.pull.connection);
    assert(mq.pull.queue.type === "pull");
    assert(mq.pull.queue.name === "leonie");
  });

  it("should receive sent strings", function (done) {
    mq.push.queue.publish("bonjour!");
    mq.pull.queue.subscribe(function (msg) {
      assert(msg == "bonjour!");
      done();
    });
  });

  it("should receive sent json", function (done) {
    mq.push.queue.publish({salutation:"bonjour!"});
    mq.pull.queue.subscribe(function (msg) {
      assert.deepEqual(msg, {salutation:"bonjour!"});
      done();
    });
  });

  it("should receive sent arrays", function (done) {
    mq.push.queue.publish(["salutation", "bonjour!"]);
    mq.pull.queue.subscribe(function (msg) {
      assert.deepEqual(msg, ["salutation", "bonjour!"]);
      done();
    });
  });
});

