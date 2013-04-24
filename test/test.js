var assert = require("assert")

var cmq = require("../")

describe("stub cluster test", function () {
  it("can call the api", function (done) {
    cmq.declare("forsooth!", function (value) {
      assert.equal(value.whatever, "forsooth!")
      done()
    })
  })
})

describe("SomeTest", function () {
  it.skip("sync fail", function () {
    assert(false, "ok")
  })
  it.skip("leaks globals", function () {
    bad_global = "OOPS"
  })
  it("sync pass", function () {
    assert(true, "ok")
  })
  it("async pass", function (done) {
    process.nextTick(function () {
      assert(true, "ok")
      done()
    })
  })
})

