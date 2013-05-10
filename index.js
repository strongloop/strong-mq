// clustermq

var copy = require('underscore').clone;
var parse = require('url').parse;

// Attempt to lazy-load providers on reference

function urlProvider(url) {
  var protocol = parse(url).protocol;
  return protocol.split(':')[0];
}

function extractProvider(options) {
  var provider;
  var url;
  if (typeof options == 'string') {
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

exports.create = function(options) {
  var parsed = extractProvider(options || {
    provider: 'native'
  });
  var provider = parsed[0];
  var url = parsed[1];
  options = parsed[2];
  if (!providers[provider]) {
    providers[provider] = require('./' + provider);
  }
  return new providers[provider](provider, url, options);
};

