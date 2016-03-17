Gateway Publish
===============

Publish parsed packets from the gateway to a variety of
protocols:

- UDP Broadcast
- WebSockets

Each protocol can be individually disabled in the config file.


Config
------

Create `/etc/swarm-gateway/publish.conf`. Available options:

```
udpPublish = true          # defaults to false
udpPort = 3002             # defaults to 3002

websocketsPublish = true   # defaults to true
websocketPort = 3001       # defaults to 3001

mqttTopic = gateway-data   # defaults to gateway-data
```

