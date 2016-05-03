// Copyright IBM Corp. 2013. All Rights Reserved.
// Node module: strong-mq
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0

// dbg: console.log if NODE_SLMQ_DEBUG is in env, otherwise silent

if (process.env.NODE_SLMQ_DEBUG) {
  module.exports = console.log;
} else {
  module.exports = function() {};
}
