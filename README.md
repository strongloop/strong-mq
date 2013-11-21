# strong-mq: Clustering of Applications on Top of Message Queues

[strong-mq](https://github.com/strongloop/sl-mq) is an abstraction layer
over common message distribution patterns, and several different message queue
implementations, including cluster-native messaging.

It allows applications to be written against a single message queue style API,
and then deployed either singly, or as a cluster, with deploy-time configuration
of the messaging provider.  Providers include native node clustering, allowing
no-dependency deployment during test and development. Support for other
providers is on-going, and 3rd parties will be able to add pluggable support for
new message queue platforms.

## Message Patterns

- work queue: published messages are delivered to a single subscriber, common
  when distributing work items that should be processed by a single worker
- topic: published messages are delivered to all subscribers, each message is
  associated with a "topic", and subscribers can specify the topic patterns they
  want to receive
- rpc: published messages are delivered to a single subscriber, and a associated
  response is returned to the original publisher (TBD)

## Installation

    % npm install strong-mq
    % npm test

## Synopsis

An example of connecting to a server and listening on a work queue:

```javascript
var connection = require('strong-mq')
    .create('amqp://localhost')
    .open();

var push = connection.createPushQueue('todo-items');
push.publish({job: 'clean pool'});

var pull = connection.createPullQueue('todo-items');
pull.subscribe(function(msg) {
    console.log('TODO:', msg);
    connection.close();
});
```

## Event: 'error'

Errors may be emitted as events from either a connection or a queue.  The nature of the
errors emitted depends on the underlying provider.

## Messages

Message objects can be either an `Object` or `Array`, transmitted as JSON, or a `String`
or `Buffer`, transmitted as data.

## Queues

Queues are closed when they are empty and have no users. They might or might not
be persistent across restarts of the queue broker, depending on the provider.
