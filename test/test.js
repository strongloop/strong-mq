var assert = require("assert");
var async = require("async");
var cmq = require("../");

describe("declaration", function () {
  it("declare amqp connector", function () {
    var mq = cmq.declare({provider:'amqp'});
    assert.equal(mq.provider, 'amqp');
  });

  it("should puke on invalid inputs", function () {
    // TODO convention for arg checking: assert?
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
    var mq = cmq.declare({provider:'amqp'});
    mq.open(function (err) {
      if (err) return done(err);
      mq.close(done);
    });
  });

  it("callback error on an invalid open", function (done) {
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
    mq = cmq.declare({provider:'amqp'});
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

  it("should publish into a queue", function (done) {
    var pushQueue = mq.pushQueue("june", function (err) {
      if (err) return done(err);
      pushQueue.publish("bonjour, la soleil");
      pushQueue.close();
      done();
    });
  });

});

var connectAndOpen = function (options, qtype, qname, callback) {
  var mq = cmq.declare(options);

  mq.open(function (err) {
    if (err) return callback(err);

    mq[qtype].call(mq, qname, function (err, queue) {
      if (err) { mq.close(); return callback(err); }

      callback(err, {connection: mq, queue: queue});
    });
  });
};

var closeAndDisconnect = function (queue, connection, callback) {
  queue.close();
  connection.close(callback);
};

var AMQP = {provider:'amqp'};

describe("push and pull into work queues", function () {
  var mq;

  beforeEach(function (done) {
    async.parallel({
      push: function (callback) {
        connectAndOpen({provider:'amqp'}, "pushQueue", "leonie", callback);
      }
      , pull: function (callback) {
        connectAndOpen({provider:'amqp'}, "pullQueue", "leonie", callback);
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
    assert(mq.push.queue._q);
    // would like to do a type-of, or something, don't know what breaks
    // encapuslation most, use of undocumented internals, or dependency on
    // underlying instance type

    assert(mq.pull.connection);
    assert(mq.pull.queue._q);
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

