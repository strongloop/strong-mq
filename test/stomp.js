// Copyright IBM Corp. 2013. All Rights Reserved.
// Node module: strong-mq
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0

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
