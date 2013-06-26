var assert = require('assert');
var _stomp = require('../lib/adapters/stomp');

describe('stomp', function() {
  describe('url parsing', function() {
    function expect(url, options) {
      it('should parse '+url, function() {
        var parsed = _stomp._parseUrl(url);
        Object.keys(options).forEach(function(key) {
          assert.equal(parsed[key], options[key]);
        });
      });
    }
    expect('stomp://', {
    });
    expect('stomp://a.b.c', {
      host: 'a.b.c',
    });
    expect('stomp://a.b.c:99', {
      host: 'a.b.c',
      port: 99,
    });
    expect('stomp://:99', {
      port: 99,
    });
    expect('stomp://user@a.b.c:99', {
      host: 'a.b.c',
      port: 99,
      login: 'user',
    });
    expect('stomp://user:pass@a.b.c:99', {
      host: 'a.b.c',
      port: 99,
      login: 'user',
      password: 'pass',
    });
  });
});
