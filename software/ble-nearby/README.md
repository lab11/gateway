Nearby BLE Devices
==================

Determine and provide an MQTT topic for which detected devices are 'nearby' the
gateway.

In order to determine, this service discovers other gateways and connects to
them. Signal strength and packet reception ratios are compared between gateways
for each device. A list of which devices are nearby is published every ten
seconds to the topic `ble-nearby`.

