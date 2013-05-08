// Trying things out with mocha

var assert = require('assert');

describe('SomeTest', function() {
  it.skip('sync fail', function() {
    assert(false, 'ok');
  });
  it.skip('leaks globals', function() {
    badGlobal = 'OOPS';
  });
  it('sync pass', function() {
    assert(true, 'ok');
  });
  it('async pass', function(done) {
    process.nextTick(function() {
      assert(true, 'ok');
      done();
    });
  });
});


