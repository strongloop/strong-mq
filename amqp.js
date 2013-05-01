// Provider: AMQP

module.exports = DeclareAmqp;

var amqp = require('amqp');
var assert = require('assert');

// Supported options are as for amqp.createConnection():
//   host, port, login, password, vhost
function DeclareAmqp(provider, url, options) {
  this.provider = provider;
  this._connectOptions = url ? {url:url} : options;
}

// XXX don't rewrite .on(), be an event emitter
DeclareAmqp.prototype.on = function (event, listener) {
  this._connection.on(event, listener);
};

DeclareAmqp.prototype.open = function (callback) {
  assert(!this._connection, 'cannot open if already open');

  var c = this._connection = amqp.createConnection(this._connectOptions);

  function onReady() {
    c.removeListener('error', onError);
    callback();
  }

  function onError(er) {
    c.removeListener('ready', onReady);
    callback(er);
  }

  c.once('ready', onReady);
  c.once('error', onError);

  return this;
};

DeclareAmqp.prototype.close = function (callback) {
  if (this._connection) {
    if (callback) {
      this._connection.on('close', function (had_error) {
        // discard had_error, it's boolean instead of an Error object
        callback();
      });
    }
    this._connection.end();
    this._connection = null;
  }
  return this;
};

// Get amqp connection for a queue
function c(q) {
  return q._declaration._connection;
}

// XXX factor common code out of push/pull

// Common options when creating and destroying queues
var CREATE_OPTIONS = {
  autoDelete: true,
};

// Using these options causes an error event to be emitted if the q is in use
// or non-empty, so the autoDelete flag appears to be a better way.
var DESTROY_OPTIONS = {
  //ifUnused: true,
  //ifEmpty: true,
};

function queueOpen (self, type, declaration, name, callback) {
  self.name = name;
  self.type = type;
  self._declaration = declaration;
  self._q = c(self).queue(name, CREATE_OPTIONS, function () {
    callback(null, self);
  });
  // XXX need to write test to force error, then catch event, and
  // pass to callback. I think mismatch of queue type might work.
}

function queueClose (callback) {
  var q = this._q;

  // XXX self._q = null
  function onDone() {
    q.removeListener('error', onError);
    callback();
  }

  function onError(er) {
    q.removeListener('close', onDone);
    callback(er);
  }

  if (callback) {
    q.once('close', onDone);
    q.once('error', onError);
  }

  q.close();

  return this;
}

// XXX should be an EventEmitter
function queueOn(event, listener) {
  this._q.on(event, listener);
}

function PushAmqp (declaration, name, callback) {
  queueOpen(this, 'push', declaration, name, callback);
}

PushAmqp.prototype.on = queueOn;

PushAmqp.prototype.publish = function (msg) {
  c(this).publish(this._q.name, msg);
  return this;
};

PushAmqp.prototype.close = queueClose;

DeclareAmqp.prototype.pushQueue = function (name, callback) {
  return new PushAmqp(this, name, callback);
};

function PullAmqp (declaration, name, callback) {
  queueOpen(this, 'pull', declaration, name, callback);
}

PullAmqp.prototype.on = queueOn;

PullAmqp.prototype.subscribe = function (callback) {
  this._q.subscribe(/* ack? prefetchCount? */ function (msg) {
    if (msg.data && msg.contentType)
      msg = msg.data; // non-json
    // else msg is already-parsed json
    callback(msg);
  });
  return this;
};

PullAmqp.prototype.close = queueClose;

DeclareAmqp.prototype.pullQueue = function (name, callback) {
  return new PullAmqp(this, name, callback);
};

