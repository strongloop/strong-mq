var assert = require('assert');
var mq = require('../index');

function listenerCount(emitter, event) {
  return emitter.listeners(event).length;
}

describe('native', function() {
  describe('should remove event listeners', function() {
    it('after multiple subscribes', function(done) {
      var connection = mq.create().open();
      var sub = connection.createSubQueue('some-sub');
      var messageListenerCount = listenerCount(sub.queue, 'publish');
      sub.subscribe('xxx').subscribe('yyy');
      connection.close(function() {
        assert.equal(listenerCount(sub.queue, 'publish'), messageListenerCount);
        done();
      });
    });
  });
});
