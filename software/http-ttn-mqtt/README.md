TTN to MQTT
===========

This pulls data from a Things Network application and formats it for
the gateway MQTT format.

This also expects (but doesn't strictly require) that the raw data has already
been formatted in the TTN application.




### Config

If multiple gateways receive the same packet, save all packets received, or just
the best RSSI reception.

```
recordAllReceptions = bool
```
