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

