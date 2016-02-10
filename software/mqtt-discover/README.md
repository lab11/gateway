MQTT Discover
=============

This tool uses mDNS-SD to discover a nearby MQTT broker. It firsts checks
the localhost, then tries to find a broker on the local subnet.

Usage
-----

```javascript
var MQTTDiscover = require('mqtt-discover');


MQTTDiscover.on('mqttBroker', function (mqtt_client) {
    // Start the gateway
    console.log('Found MQTT client: ' + mqtt_client.options.href);
});

// Find MQTT server
MQTTDiscover.start();
```
