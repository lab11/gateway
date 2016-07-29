Gateway to MQTT Topics
==========================

Send the global stream `gateway-data` to individual
MQTT topics:

    device/<device type>/<device id>

For example:

    device/BLEES/c098e5300099


List Topics
-----------

You can see all valid `device` topics by listening to:

    gateway-topics

Command:

    $ mosquitto_sub -h <mqtt broker ip address> -t gateway-topics



Get all data for a type of sensor
---------------------------------

    $ mosquitto_sub -h <mqtt broker ip address> -t device/<device type>/+


Usage
-----

```js
var GatewayTopics = require('gateway-topics');

var obj = {
	device: 'DeviceName',
	<other fields>: <other values>
};

GatewayTopics.publish(obj);
```
