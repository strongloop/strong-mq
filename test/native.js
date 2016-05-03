// Copyright IBM Corp. 2013. All Rights Reserved.
// Node module: strong-mq
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0

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
