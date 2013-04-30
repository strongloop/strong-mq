// clustermq

var copy = require('underscore').clone;

var parse = require("url").parse;

// declaration of providers

function urlProvider(url) {
  var protocol = parse(url).protocol;
  return protocol.split(":")[0];
}

function extractProvider(options) {
  var provider;
  var url;
  if (typeof options == "string") {
    provider = urlProvider(options);
    url = options;
    options = null;
  } else {
    provider = options.provider;
    url = null;
    options = copy(options);
    delete options.provider;
  }

  return [provider, url, options];
}

var providers = {};

exports.declare = function (options) {
  var parsed = extractProvider(options);
  var provider = parsed[0];
  var url = parsed[1];
  options = parsed[2];
  return new providers[provider](provider, url, options);
};

providers.amqp = require("./amqp");

