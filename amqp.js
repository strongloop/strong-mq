// Provider: AMQP

module.exports = DeclareAmqp;

var amqp = require('amqp');
var assert = require('assert');
var events = require('events');
var util = require('util');

function forwardEvent(name, from, to)
{
  from.on(name, to.emit.bind(to, name));
}

//-- Connection

function DeclareAmqp(provider, url, options) {
  this.provider = provider;
  options = url ? {url:url} : options;
  amqp.Connection.call(this, options);
}

util.inherits(DeclareAmqp, amqp.Connection);

DeclareAmqp.prototype.open = function (callback) {
  //XXX assert(!this._connection, 'cannot open if already open');
  assert(callback);
  var self = this;
  this.once('ready', callback);
  this.connect();
  return this;
};

DeclareAmqp.prototype.close = function (callback) {
  //XXXassert(this._connection, 'cannot close if not open');
  if (callback) {
    this.once('close', function () {
      callback(); // discard the arguments
    });
  }
  this.end();
  return this;
};

// XXX override .emit(), and filter out connection reset events after close?

//-- Push/Pull Queue

// Get amqp connection for a queue
function c(q) {
  return q._connection;
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

function queueOpen (self, type, connection, name, callback) {
  self.name = name;
  self.type = type;
  self._connection = connection;
  self._q = c(self).queue(name, CREATE_OPTIONS, function () {
    callback(); // discard arguments from underlying cb
  });
  forwardEvent('error', self._q, self);
}

function queueClose (callback) {
  assert(this._q, 'cannot close queue if not open');

  if (callback) {
    this._q.once('close', callback);
  }

  this._q.close();
  this._q = null;

  return this;
}

function PushAmqp (declaration, name, callback) {
  queueOpen(this, 'push', declaration, name, callback);
}

util.inherits(PushAmqp, events.EventEmitter);

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

util.inherits(PullAmqp, events.EventEmitter);

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

