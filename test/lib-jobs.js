// Copyright IBM Corp. 2013. All Rights Reserved.
// Node module: strong-mq
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0

var delayed = require('../lib/jobs').delayed;
var assert = require('assert');

describe('job queue', function() {
  it('should wait to start', function(done) {
    var started = false;
    var jobs = delayed(function() {
      //console.log('drained');
      assert(started);
      done();
    });

    process.nextTick(function() {
      jobs.push(function(callback) {
        started = true;
        //console.log('first job');
        process.nextTick(callback);
      });
    });

    process.nextTick(function() {
      process.nextTick(function() {
        assert(!started, 'two ticks later, still not started');
        //console.log('before start');
        jobs.start();
        //console.log('after start');
      });
    });
  });

  it('should do jobs immediately after start', function(done) {
    var started = false;
    var jobs = delayed(function() {
      assert(started);
      done();
    }).start();

    jobs.push(function(callback) {
      started = true;
      callback();
    });

    assert(!started, 'pushed jobs are done in next tick');
  });
});
