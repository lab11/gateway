Sensor Monitor for Gateway Devices
==================================

This tool creates virtual devices in Sensu for devices detected
by the gateway. It does this by creating RabbitMQ messages it sends
directly to the Sensu Server.

Configuration
-------------

The parameters for this service are specified in `/etc/swarm-gateway/sensu.conf`.

```
host = <hostname of the rabbit mq broker to send to>
port = 5672
vhost = /sensu
user = <username for sensu in RabbitMQ>
password = <password> for sensu in RabbitMQ>
ignore = <comma separated list of device names to ignore>
```

