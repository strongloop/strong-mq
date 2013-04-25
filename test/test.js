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
    var mq = cmq.declare({provider:'amqp'})
    mq.open(function (err) {
      if (err) return done(err);
      mq.close(done)
    });
  });

  it("callback error on an invalid open", function (done) {
    var mq = cmq.declare({provider:'amqp', port:1})
    mq.open(function (err) {
      assert(err);
      done();
    });
  });

});

