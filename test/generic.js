// generic api tests, should run against all providers

var assert = require('assert');
var dbg = require('../lib/dbg');
var slmq = require('../');


PROVIDERS = [
  'stomp',
//'amqp',
  'native',
];


function forEachProvider(callback) {
  PROVIDERS.forEach(function(provider) {
    describe(provider + ' provider', function () {
      describe('with options object', function() {
        callback(provider, {provider: provider});
      });
      describe('with options url', function() {
        callback(provider, provider + ':');
      });
    });
  });
}


describe('regardless of provider', function() {
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
});


forEachProvider(function(provider, options) {
  it('should have a provider property', function() {
    var mq = slmq.create({provider: provider});
    assert.equal(mq.provider, provider);
  });


  (function() {
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

    //XXX(sam) I was pretty sure //localhost was required by amqp, what's up?
    it('should open and close', function(done) {
      openAndClose(options, done);
    });
  })();


  // XXX(sam) next are difficult, we are victim of underlying lib, I wanted
  // them because its nice to detect usage errors immediately, rather than just
  // damaging the connection which shows up later.
  // XXX(sam) if these were being implemented, I would wrap and paramaterize for
  // each provider
  describe.skip('when open and close are misused', function() {
    it('should throw or ignore multiple open', function(done) { });

    it('should throw or ignore close when never opened', function() { });

    it('should throw on close after closed', function(done) { });

  });


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


  it('should open and double close a push queue', function(done) {
    var mq = slmq.create(options).open();
    var q = mq.createPushQueue('june');
    q.close();
    q.close();
    mq.close(done);
  });


  it('should open and double close a pull queue', function(done) {
    var mq = slmq.create(options).open();
    var q = mq.createPullQueue('june');
    q.close();
    q.close();
    mq.close(done);
  });


  describe('on work queue push then pull', function() {
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

  it('should open and double close a pub queue', function(done) {
    var mq = slmq.create(options).open();
    var q = mq.createPubQueue('june');
    q.close();
    q.close();
    mq.close(done);
  });


  it('should open and double close a sub queue', function(done) {
    var mq = slmq.create(options).open();
    var q = mq.createSubQueue('june');
    q.close();
    q.close();
    mq.close(done);
  });


  it('should allow subscribe before publish', function(done) {
    var cpub, qpub, csub, qsub;
    csub = slmq.create(options).open();
    qsub = csub.createSubQueue('leonie');

    qsub.subscribe('');
    csub.close(function() {
      done();
    });
  });

  // XXX(sam) test multiple pub and sub on same queue name


  describe('on topic queue subscribe then publish', function() {
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
      republish = false;
      csub.close(function() {
        cpub.close(done);
      });
    });

    function shouldMatchTopic(pubTopic, subTopic) {
      function printable(s) {
        if (s == null) {
          return s;
        }
        return '"'+s+'"';
      }
      it('should subscribe on ' + printable(subTopic) + ' and ' +
         'receive topic ' + printable(pubTopic), function(done) {
        var obj = 'quelle affaire';

        qsub.subscribe(subTopic, function(msg) {
          if(done) {
            assert.equal(obj, msg);
            done();
            done = null;
          }
        });

        // Race condition, publications are dropped until broker knows about
        // subscription, by design, but we don't know when that has happened.
        // Work-around is to keep publishing until test is done.
        setImmediate(republishLoop);
        function republishLoop() {
          if (republish) {
            qpub.publish(obj, pubTopic);
            setTimeout(republishLoop, 50);
          }
        }
      });
    }

    it('should close unsubscribed queues', function(done) {
      var cpub, qpub, csub, qsub;
      cpub = slmq.create(options).open();
      qpub = cpub.createPubQueue('leonie');
      csub = slmq.create(options).open();
      qsub = csub.createSubQueue('leonie');
      cpub.close(function() {
        csub.close(function() {
          done();
        });
      });
    });

    shouldMatchTopic('some.thing.specific.deep', 'some.thing');
    shouldMatchTopic('some.thing.specific', 'some.thing');
    shouldMatchTopic('some.thing', 'some.thing');

    shouldMatchTopic('some.thing.specific', 'some');
    shouldMatchTopic('some.thing', 'some');
    shouldMatchTopic('some', 'some');

    shouldMatchTopic('some.thing.specific', '');
    shouldMatchTopic('some.thing', '');
    shouldMatchTopic('some', '');
    shouldMatchTopic('', '');
    shouldMatchTopic(null, '');

    shouldMatchTopic('some.thing.specific', null);
    shouldMatchTopic('some.thing', null);
    shouldMatchTopic('some', null);
    shouldMatchTopic('', null);
    shouldMatchTopic(null, null);
  });
});
