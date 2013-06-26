var assert = require('assert');
var async = require('async');
var dbg = require('../lib/dbg');
var slmq = require('../');


var AMQP = {provider: 'amqp'};


describe.skip('open with amqp', function() {
  it('should error on a connect failure', function(done) {
    var mq = slmq.create({provider: 'amqp', port: 1});
    mq.NAME = 'FIRST';
    mq.open(function() {
      assert(false); // unreachable on failure
    }).on('error', function(er) {
      dbg('on err', mq.NAME, er);
      assert(er);
      done();
    });
  });
});
