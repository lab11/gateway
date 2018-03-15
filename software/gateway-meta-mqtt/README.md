Gateway Meta MQTT
============

Publishes metadata about the gateway as a data stream.

Example Packet
--------------

```
var adv_obj = {
    device: "GatewayAddresses",
    addresses: <comma separated string of ip addresses>,

    _meta = {
        received_time: new Date().toISOString(),
        device_id:     gateway_id_no_colons,
        receiver:      'gateway-meta',
        gateway_id:    gateway_id
	}
};
