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

## Installation

    % npm install strong-mq
    % npm test

### Multiple Versions of strong-mq Being Initialized

If you get an assert during require of strong-mq about multiple versions being
initialized, then some of the modules you are depending on use strong-mq, but do
not specify it as a peerDependency. See
[strongloop/strong-cluster-connect-store](https://github.com/strongloop/strong-cluster-connect-store/commit/dd00ed6978a676725c863e4ce0473bc8d2997d2f)
as an example of how to correctly specify a dependency on strong-mq in a module.
An application can depend on strong-mq with a normal dependency.

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

## Documentation

- See [API](api.md) and [StrongLoop](http://docs.strongloop.com/display/DOC/Strong+MQ)
