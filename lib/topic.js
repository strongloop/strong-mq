// topic: utility code for topics

var assert = require('assert');

exports.valid = valid;
exports.check = check;
exports._escape = escape;
exports.matcher = matcher;

function valid(topic) {
  if (!isString(topic)) {
    return false;
  }

  if (topic === '') {
    return true;
  }

  if (/^\w+(?:\.\w+)*$/.test(topic)) {
    return true;
  }

  return false;
}

function check(pattern) {
  if (pattern == null) {
    pattern = '';
  }

  assert(valid(pattern), 'topic patterns must be .-separated alphanumeric words');

  return pattern;
}

function isString(obj) {
  return typeof obj === 'string' || obj instanceof String;
}

function escape(topic) {
  topic = check(topic);

  return topic.replace(/\./g, '\\.');
}

function matcher(topic) {
  topic = escape(topic);

  // /^\b/ won't match 'fu', so bypass regex in this case
  if (topic === '') {
    return {
      test: function () { return true; }
    };
  }

  return RegExp('^' + topic + '\\b');
}
