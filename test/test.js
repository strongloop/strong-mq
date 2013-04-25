var assert = require("assert");
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



describe("push and pull from work queue", function () {
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

  it("should open and close a pull queue", function (done) {
    var pullQueue = mq.pullQueue("june", function (err) {
      if (err) return done(err);
      pullQueue.close();
      done();
    });
  });

  it("should push into a queue", function (done) {
    var pushQueue = mq.pushQueue("june", function (err) {
      if (err) return done(err);
      pushQueue.push("bonjour, la soleil");
      pushQueue.close();
      done();
    });
  });

});

