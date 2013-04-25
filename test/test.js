var assert = require("assert");
var cmq = require("../");

describe("stub cluster test", function () {
  it("can call the api", function (done) {
    cmq.declare("forsooth!", function (value) {
      assert.equal(value.whatever, "forsooth!");
      done();
    });
  });
});
