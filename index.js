// clustermq

var amqp = require("amqp");
var assert = require("assert");

var providers = {};

// amqp

providers.amqp = DeclareAmqp;

// Supported options are as for amqp.createConnection(): host, port, login,
// password, vhost.
function DeclareAmqp(options) {
  this.provider = options.provider;
  this._connectOptions = copy(options);

  delete this._connectOptions.provider;
}

DeclareAmqp.prototype.open = function (callback) {
  assert(!this._connection, "connectors can only be opened once");

  var c = this._connection = amqp.createConnection(this._connectOptions);

  function on_ready() {
    c.removeListener('error', on_error);
    callback();
  }

  function on_error(err) {
    c.removeListener('ready', on_ready);
    callback(err);
  }

  c.once('ready', on_ready);
  c.once('error', on_error);

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

// FIXME not clear where errors go... should we register for
// error event before every interaction? Can errors occur at
// other times, necessitating a error handler for the whole
// connection? Hm.

// Get amqp connection for a queue
function c(q) {
  return q._declaration._connection;
}

// callback with err, or (null, queue) when queue is ready
function PushAmqp (declaration, name, callback) {
  var self = this;
  this._declaration = declaration;
  this._q = c(this).queue(name, function () {
    callback(null, self);
  });
}

PushAmqp.prototype.push = function (msg) {
  c(this).publish(this._q.name, msg);
  return this;
};

PushAmqp.prototype.close = function() {
  this._q.destroy(/* ifUnused? ifEmpty? */);
};

DeclareAmqp.prototype.pushQueue = function (name, callback) {
  return new PushAmqp(this, name, callback);
};

function PullAmqp (declaration, name, callback) {
  var self = this;
  this._declaration = declaration;
  this._q = c(this).queue(name, function () {
    callback(null, self);
  });
}

PullAmqp.prototype.subscribe = function (callback) {
  this._q.subscribe(/* ack? prefetchCount? */ function (msg) {
    if (msg.data && msg.contentType)
      msg = msg.data; // non-json
    // else msg is already-parsed json
    callback(msg);
  });
  return this;
};

PullAmqp.prototype.close = function() {
  this._q.destroy(/* ifUnused? ifEmpty? */);
};

DeclareAmqp.prototype.pullQueue = function (name, callback) {
  return new PullAmqp(this, name, callback);
};


// options.provider: mandatory, one of "amqp"
// options.*: as supported by provider
// TODO support a URL string alternative to an options object
exports.declare = function (options) {
  return new providers[options.provider](options);
};

// TODO find libs for these
function copy(s) {
  var t = {};
  for (var p in s) {
    t[p] = s[p];
  }
  return t;
}

