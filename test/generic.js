// generic api tests, should run against all providers

var assert = require('assert');
var dbg = require('../lib/dbg');
var slmq = require('../');


describe('create', function() {
  it('should create native with no options', function() {
    var mq = slmq.create();
    assert.equal(mq.provider, 'native');
  });

  it('should throw if options has no provider', function() {
    assert.throws(function() {
      slmq.create({});
    });
  });

  it('shold throw if options has unknown provider', function() {
    assert.throws(function() {
      slmq.create({provider: 'no such provider'});
    });
  });

  it('shold throw if url has unknown provider', function() {
    assert.throws(function() {
      slmq.create('nosuchprovidereverreallyatall://localhost');
    });
  });

});


function describeCreate(provider) {
  describe('create with ' + provider, function() {
    it('should create with options', function() {
      var mq = slmq.create({provider: provider});
      assert.equal(mq.provider, provider);
    });

    it('should create with url', function() {
      var mq = slmq.create(provider + ':');
      assert.equal(mq.provider, provider);
    });

  });
}

describeCreate('amqp');
describeCreate('native');


function describeOpen(provider) {
  function openAndClose(options, done) {
    slmq.create(options)
    .open()
    .close(function() {
      // don't call done twice
      if (done) {
        done();
      }})
      .once('error', function(er) {
        if (er.code === 'ECONNRESET') {
          // Some rabbitmq servers don't like to have the connection
          // just opened and closed. This code path shouldn't effect
          // providers that don't have floppy ears.
          er = null;
        }
        done(er);
        done = null;
      });
  }

  describe('open with ' + provider, function() {
    it('should open with options', function(done) {
      openAndClose({provider: provider}, done);
    });

    it('should open with url', function(done) {
      openAndClose(provider + ':', done);
      //XXX(sam) I was pretty sure //localhost was required by amqp, what's up?
    });

  });
}

describeOpen('amqp');
describeOpen('native');


// XXX(sam) next are difficult, we are victim of underlying lib, I wanted
// them because its nice to detect usage errors immediately, rather than just
// damaging the connection which shows up later.
// XXX(sam) if these were being implemented, I would wrap and paramaterize for
// each provider
describe.skip('open and close misuse', function() {
  it('should throw or ignore multiple open', function(done) { });

  it('should throw or ignore close when never opened', function() { });

  it('should throw on close after closed', function(done) { });

});


function describePushQueueOpenAndClose(provider) {

  function withOptions(tag, options) {
    var suffix = ' with '  + provider + ' and ' + tag;

    describe('work queues' + suffix, function() {

      it('should open and close a push queue', function(done) {
        var mq = slmq.create(options).open();
        var q = mq.createPushQueue('june');
        assert(q);
        assert(q.type === 'push');
        assert(q.name === 'june');
        mq.close(done);
      });

      it('should open and close a pull queue', function(done) {
        var mq = slmq.create(options).open();
        var q = mq.createPullQueue('june');
        assert(q);
        assert(q.type === 'pull');
        assert(q.name === 'june');
        mq.close(done);
      });

    });

    describe('work queue push then pull' + suffix, function() {

      var cpush, qpush, cpull, qpull;

      beforeEach(function() {
        cpush = slmq.create(options).open();
        qpush = cpush.createPushQueue('june');
        cpull = slmq.create(options).open();
        qpull = cpull.createPullQueue('june');
      });

      afterEach(function(done) {
        cpull.close(function() {
          cpush.close(done);
        });
      });

      it('should deliver strings', function(done) {
        var obj = 'bonjour!';
        qpush.publish(obj);
        qpull.subscribe(check);
        function check(msg) {
          assert.equal(msg, obj);
          done();
        }
      });

      it('should deliver buffers', function(done) {
        var obj = Buffer('bonjour!');
        qpush.publish(obj);
        qpull.subscribe(check);
        function check(msg) {
          assert.equal(String(msg), obj);
          done();
        }
      });

      it('should deliver objects', function(done) {
        var obj = {salutation: 'bonjour!'};
        qpush.publish(obj);
        qpull.subscribe(check);
        function check(msg) {
          assert.deepEqual(msg, obj);
          done();
        }
      });

      it('should deliver arrays', function(done) {
        var obj = {salutation: 'bonjour!'};
        qpush.publish(obj);
        qpull.subscribe(check);
        function check(msg) {
          assert.deepEqual(msg, obj);
          done();
        }
      });

    });

    describe('topic queue subscribe then publish' + suffix, function() {
      var cpub, qpub, csub, qsub;
      var republish;

      beforeEach(function() {
        cpub = slmq.create(options).open();
        qpub = cpub.createPubQueue('leonie');
        csub = slmq.create(options).open();
        qsub = csub.createSubQueue('leonie');
        republish = true;
      });

      afterEach(function(done) {
        csub.close(function() {
          cpub.close(done);
        });
        republish = false;
      });

      function shouldMatchTopic(pubTopic, subTopic) {
        it('should subcribe on ' + subTopic + ' and ' +
           'receive topic ' + pubTopic, function(done) {
          var obj = 'quelle affaire';

          qsub.subscribe(subTopic, function(msg) {
            if(done) {
              assert.equal(obj, msg);
              done();
              done = null;
            }
          });

          // Race condition, publications are dropped until broker knows about
          // subscription, by design, but at least for amqp, we don't know when
          // that has happened.  Work-around is to keep publishing until test is
          // done.
          setImmediate(republishLoop);
          function republishLoop() {
            if (republish) {
              qpub.publish(obj, pubTopic);
              setImmediate(republishLoop);
            }
          }
        });
      }

      shouldMatchTopic('some.thing.specific', 'some');
      shouldMatchTopic('some.thing', 'some');
      shouldMatchTopic('some', 'some');

    });
  }

  withOptions('options', {provider: provider});
  withOptions('url', provider + ':');
}

describePushQueueOpenAndClose('amqp');
describePushQueueOpenAndClose('native');
