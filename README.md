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

## Connections

### slmq.create([options|url])

Returns a connection object for a specific provider, configuration can
be created using a options object, or a url:

* `options` {Object}
* `url` {provider://...}

If `create()` is called with no arguments, the native provider will be used.

Supported providers are:

* `'amqp'`: RabbitMQ
* `'native'`: Cluster-native messaging

Supported options, other than `provider`, depend on the provider:

* `provider` {String} Mandatory name of provider, such as `'amqp'`
* `host` {String} Name of host to connect to (if supported by provider)
* `port` {String} Port to connect to (if supported by provider)
* `...` As supported by the provider

Example of creating an amqp connection, using an options object:

    connection = clustemq.create({
        provider: 'amqp',
        host: 'localhost',
        user: 'guest',
    });

Example of declaring amqp, using a URL:

    connection = clusermq.create('amqp://guest@localhost');

### connection.provider {String}

Property is set to the name of the provider.


### connection.open()

Opens a connection.

Example:

    connection.open().on('error', function () {
      // ... handle error
    });

### connection.close([callback])

Callsback when connection has been closed.

## Work queues (push/pull)

### connection.createPushQueue()

Return a queue for publishing work items.

### push.publish(msg)

Publish a msg to a push queue.

* `msg` {Object} Message to publish to the queue

### connection.createPullQueue()

Return a queue for subscribing to work items.

### pull.subscribe([listener])

Listen for messages on a work queue.

`listener` is optional, it will be added as a listener
for the `'message'` event if provided.

### queue.close()

Close the queue.

### queue.name {String}

Name used to create queue.

### queue.type {String}

Either 'push', or 'pull'.

### Event: 'message'

Event is emitted when a subcribed pull queue receives a message.

* `msg` {Object} Message pulled off the queue

## Topic queue (pub/sub)

Topics are dot-separated alphanumeric (or `'_'`) words. Subscription patterns match
leading words.

### connection.createPubQueue()

Return a queue for publishing on topics.

### pub.publish(msg, topic)

* `msg` {Object} Message to publish onto the queue
* `topic` {String} Topic of message, default is `''`

### connection.createSubQueue()

Return a queue for subscribing to topics.

### sub.subscribe(pattern[, listener])

Listen for messages matching pattern on a topic queue.

* `pattern` {String} Pattern of message, may contain wildcards, default is `''`

`listener` is optional, it will be added as a listener for the `'message'` event
if provided. Add your listener to the `'message'` event directly when
subscribing multiple times, or all your listeners will be called for all
messages.

Example of subscribing to multiple patterns:

    sub.subscribe('that.*')
      .subscribe('this.*')
      .on('message', function (msg) { ... });

Example of subscribing to a single pattern, and providing a listener:

    sub.subscribe('other.*', function (msg) { ... });

### queue.close()

Close the queue.

### queue.name {String}

Name used to create queue.

### queue.type {String}

Either 'pub', or 'sub'.

### Event: 'message'

Event is emitted when a subcribed pull queue receives a message.

* `msg` {Object} Message pulled off the queue


## Provider: NATIVE

The NativeConnection uses the built-in
[cluster](http://nodejs.org/docs/latest/api/cluster.html) module to facilitate
the strong-mq API.  It's designed to be the first adapter people use in early
development, before they get whatever system they will use for deployment up and
running.

It has no options.

The URL format is:

    native:[//]

### Multiple Versions of strong-mq Being Initialized

If you get an assert during require of strong-mq about multiple versions being
initialized, then some of the modules you are depending on use strong-mq, but do
not specify it as a peerDependency. See
[strongloop/strong-cluster-connect-store](https://github.com/strongloop/strong-cluster-connect-store/commit/dd00ed6978a676725c863e4ce0473bc8d2997d2f)
as an example of how to correctly specify a dependency on strong-mq in a module.
An application can depend on strong-mq with a normal dependency.

## Provider: AMQP

Support for RabbitMQ using the AMQP protocol. This provider is based
on the [node-amqp](https://npmjs.org/package/node-amqp) module, see
its documentation for more information.

The options (except for `.provider`) or url is passed directly to node-amqp,
supported options are:

* `host` {String} Hostname to connect to, defaults to `'localhost'`
* `port` {String} Port to connect to, defaults to `5672`
* `login` {String} Username to authenticate as, defaults to `'guest'`
* `password` {String} Password to authenticate as, defaults to `'guest'`
* `vhost` {String} Vhost, defaults to `'/'`

The URL format for specifying the options above is:

    amqp://[login][:password][@]host[:port][/vhost]

Note that the `host` is mandatory when using a URL.

Note that node-amqp supports RabbitMQ 3.0.4, or higher. In particular, it will
*not* work with RabbitMQ 1.8.1 that is packaged with Debian 6, see the [upgrade
instructions](http://www.rabbitmq.com/install-debian.html).

## Provider: STOMP

Support for ActiveMQ using the STOMP protocol. This provider is based on the
[node-stomp-client](https://github.com/easternbloc/node-stomp-client) module.

The options are:

* `host` {String} Hostname to connect to, defaults to `'127.0.0.1'`
* `port` {String} Port to connect to, defaults to `61613`
* `login` {String} Username to authenticate as, defaults to none
* `password` {String} Password to authenticate as, defaults to none

The URL format for specifying the options above is:

    stomp://[login][:password][@]host[:port]

Note that the `host` is mandatory when using a URL.

ActiveMQ ships with an example configuration sufficient to run the strong-mq
unit tests.

Note that node-stomp-client has been tested only with Active MQ 5.8.0. It can be
installed from [apache](http://activemq.apache.org/activemq-580-release.html),
and run as:

    activemq console xbean:activemq-stomp.xml

## Future work

Future work may include support for the following, as needed, and if
common mechanisms exist among the various queue providers.

- Acknowledgement of msg processing, particularly for work queues, so "exactly
  once" message handling can be guaranteed. The current API is strictly "one or
  less", if a consumer fails to process a message that has been delivered to it,
  it will never be processed.
- Flow control, so consumers aren't overwhelmed by msgs, and can provide back
  pressure on the queue when under load.
- Persistence, whether queues persist beyond the existence of any users or
  undelivered messages.

