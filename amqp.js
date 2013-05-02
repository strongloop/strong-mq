// Provider: AMQP

module.exports = DeclareAmqp;

var amqp = require('amqp');
var assert = require('assert');

function onceOnEvents(emitter, okEvent, callback)
{
  function onOk() {
    emitter.removeListener('error', onEr);
    callback();
  }

  function onEr(er) {
    emitter.removeListener('ready', onOk);
    callback(er);
  }

  emitter.once(okEvent, onOk);
  emitter.once('error', onEr);

  return emitter;
}

//-- Connection

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
  assert(callback);

  this._connection = amqp.createConnection(this._connectOptions);

  onceOnEvents(this._connection, 'ready', callback);

  return this;
};

DeclareAmqp.prototype.close = function (callback) {
  assert(this._connection, 'cannot close if not open');

  if (callback) {
    onceOnEvents(this._connection, 'close', callback);
  }

  this._connection.end();
  this._connection = null;

  return this;
};

//-- Push/Pull Queue

// Get amqp connection for a queue
function c(q) {
  return q._declaration._connection;
}

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
  assert(this._q, 'cannot close queue if not open');

  if (callback) {
    onceOnEvents(this._q, 'close', callback);
  }

  this._q.close();
  this._q = null

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

