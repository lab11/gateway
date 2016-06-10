sensu-process
=============

Allows long-running processes to send keepalives to
[Sensu](https://github.com/sensu/sensu) as so that it can keep track of their
status as if they were devices.

### Example
sensu-process can automatically send keepalive packets to a Sensu server.

```
var SensuProcess = require('sensu-process');
SensuProcess.init('./sensu.conf', 'SensuTest');

// automatically send keepalives every 60 seconds
SensuProcess.begin(true, 60);
```

sensu-process can also be used to transmit keepalives on demand. This is best
suited towards processes which do things like handle packets and are likely in
an error state if they haven't processed a packet in a while. Keepalives are
automatically rate limited based on the `send_rate` parameter.

```
var SensuProcess = require('sensu-process');
SensuProcess.init('./sensu.conf', 'SensuTest');
SensuProcess.begin();

...

on.('packethandle', function () {
    SensuProcess.keepalive();
});
```

### Requirements
Needs to be pointed at a `sensu.conf` file with parameters for the RabbitMQ broker.

`sensu.conf`:
```
host = BROKER_ADDRESS
port = 5672
vhost = /sensu
user = sensu
password = PASSWORD
```

### API

SensuProcess.init(SENSU_CONFIG_PATH, PROCESS_NAME)

Initializes sensu-process

`SENSU_CONFIG_PATH`: string, path to valid sensu config file
`PROCESS_NAME`: string, name of process to appear in Sensu. Alphanumeric plus underscore and hypen


SensuProcess.begin(AUTOMATIC, SEND_RATE)

Starts sensu-process

`AUTOMATIC`: boolean, whether keepalives should be sent automatically
`SEND_RATE`: integer, minimum number of seconds between each keepalive transmission. Used as interval if in automatic mode, otherwise used to automatically rate limit calls to keepalive()


SensuProcess.keepalive()

Send a keepalive to sensu

