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
    describe('work queues with ' + provider + ' and ' + tag, function() {
      it('should open and close a push queue', function(done) {
        var mq = slmq.create(options).open();
        assert(mq.createPushQueue('june'));
        mq.close(done);
      });

      it('should open and close a pull queue', function(done) {
        var mq = slmq.create(options).open();
        assert(mq.createPullQueue('june'));
        mq.close(done);
      });

      it('should deliver with push, close, then pull', function(done) {
        this.timeout(0);
        dbg('publish start');
        var cpush = slmq.create(options).open();
        var qpush = cpush.createPushQueue('june');
        var cpull, qpull;
        var obj = 'bonjour!';

        qpush.publish(obj);

        cpush.close(subscribe);

        function subscribe() {
          dbg('subscribe start');
          cpull = slmq.create(options).open();
          qpull = cpull.createPullQueue('june');
          qpull.subscribe(check);
        }

        function check(msg) {
          dbg('check start');
          assert.equal(msg, obj);
          cpull.close(function() {
            cpush.close(done);
          });
        }
      });

    });
  }

  withOptions('options', {provider: provider});
  withOptions('url', provider + ':');
}

describePushQueueOpenAndClose('amqp');
describePushQueueOpenAndClose('native');
