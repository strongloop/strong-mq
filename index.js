// clustermq

var amqp = require("amqp");

var providers = {};

// amqp
/*
{ host: 'localhost'
  , port: 5672
  , login: 'guest'
  , password: 'guest'
  , vhost: '/'
}
*/

providers.amqp = {
  declare: function (options) {
    var mq = {
      provider: options.provider
      , connectOptions: copy(options)
    };
    delete mq.connectOptions.provider;
    return mq;
  }
};

// options.provider: mandatory, one of "amqp"
// options.*: as 
exports.declare = function (options) {
  return providers[options.provider].declare(options);
};

// TODO find lib
function copy(s) {
  var t = {};
  for (var p in s) {
    t[p] = s[p];
  }
  return t;
}

