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
