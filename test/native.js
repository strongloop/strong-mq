var assert = require('assert');
var os = require('os');
var path = require('path');
var fork = require('child_process').fork;
var slmq = require('../');
var Manager = require('./fixtures/manager');


describe('native driver', function() {
  before(function(done) {
    var filename = path.join(os.tmpDir(), 'slmq-native-test');
    var manager = Manager.createManager({
      provider: 'native',
      filename: filename
    });
    var results = this.results = {
      length: 0
    };

    fork(require.resolve('./fixtures/harness'), [], {
      env: {
        provider: 'native',
        filename: filename
      }
    }).on('exit', function() {
      manager.loadTestResults().forEach(function(line) {
        var split = line.split(':');

        assert.equal(split.length, 3, 'Malformed message: ' + line);

        results[split[0]] = results[split[0]] || {};
        results[split[0]][split[1]] = results[split[0]][split[1]] || [];
        results[split[0]][split[1]].push(split[2]);
        results.length++;
      });

      done();
    });

    this.checkMessageArray = function(recipient, name, length) {
      var array = results[recipient.toLowerCase()][name];
      assert(array, recipient + ' did not receive "' + name + '" messages.');

      var delta = length - array.length;
      assert.equal(delta, 0,
        delta + '"' + name +
        '" messages were dropped heading to ' + recipient + '.');
    };
  });

  it('should send all messages', function() {
    assert.equal(this.results.length, 240,
      (this.results.length - 240) + ' messages were dropped.');
  });

  it('should send messages to all processes', function() {
    assert(this.results.master, 'Master did not receive messages');
    assert(this.results.worker0, 'Worker0 did not receive messages');
    assert(this.results.worker1, 'Worker1 did not receive messages');
  });

  it('should filter work queues by name', function() {
    this.checkMessageArray('Master', 'master.work', 12);
    this.checkMessageArray('Master', 'all.work', 4);

    this.checkMessageArray('Worker0', 'worker0.work', 12);
    this.checkMessageArray('Worker0', 'workers.work', 6);
    this.checkMessageArray('Worker0', 'all.work', 4);

    this.checkMessageArray('Worker1', 'worker1.work', 12);
    this.checkMessageArray('Worker1', 'workers.work', 6);
    this.checkMessageArray('Worker1', 'all.work', 4);
  });

  it('should support PushQueue first or PullQueue first', function() {
    this.checkMessageArray('Master', 'master.pushfirst', 4);
    this.checkMessageArray('Master', 'master.pullfirst', 4);

    this.checkMessageArray('Worker0', 'worker0.pushfirst', 4);
    this.checkMessageArray('Worker0', 'worker0.pullfirst', 4);

    this.checkMessageArray('Worker1', 'worker1.pushfirst', 4);
    this.checkMessageArray('Worker1', 'worker1.pullfirst', 4);
  });

  it('should filter topic queues by name', function() {
    this.checkMessageArray('Master', 'master.topic.test', 12);
    this.checkMessageArray('Worker0', 'worker0.topic.test', 12);
    this.checkMessageArray('Worker1', 'worker1.topic.test', 12);

    this.checkMessageArray('Worker0', 'workers.topic.test', 12);
    this.checkMessageArray('Worker1', 'workers.topic.test', 12);

    this.checkMessageArray('Master', 'all.topic.test', 12);
    this.checkMessageArray('Worker0', 'all.topic.test', 12);
    this.checkMessageArray('Worker1', 'all.topic.test', 12);
  });

  it('should filter subscriptions by topic', function() {
    this.checkMessageArray('Master', 'all.topic.master', 12);
    this.checkMessageArray('Worker0', 'all.topic.worker0', 12);
    this.checkMessageArray('Worker1', 'all.topic.worker1', 12);

    this.checkMessageArray('Worker0', 'workers.topic.worker0', 12);
    this.checkMessageArray('Worker1', 'workers.topic.worker1', 12);
  });
});
