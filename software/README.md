Gateway Software
================

This folder contains all of the services that comprise
the gateway stack.

### Receivers

These receive data from devices:

- [BLE Gateway MQTT](https://github.com/lab11/gateway/tree/master/software/ble-gateway-mqtt):
Listens for BLE advertisements and parses the ones that provide a `parse.js` file.
- [BLE Address Sniffer](https://github.com/lab11/gateway/tree/master/software/ble-address-sniffer):
Listens for any BLE address and creates a data stream of <BLE Address, RSSI>.
- [802.15.4 Monjolo](https://github.com/lab11/gateway/tree/master/software/ieee802154-monjolo-gateway):
Listens for any [Monjolo](https://github.com/lab11/monjolo) 15.4 packets and adds them to the data
stream.

### Internal Services

These process data locally:

- [Gateway Topics](https://github.com/lab11/gateway/tree/master/software/gateway-mqtt-topics):
Takes the main stream of formatted data and makes per-device streams.
- [Gateway Publish](https://github.com/lab11/gateway/tree/master/software/gateway-publish):
Takes the main MQTT stream and re-publishes it as UDP packets and as a WebSocket.
- [Gateway Server](https://github.com/lab11/gateway/tree/master/software/gateway-server):
Display a status page for the gateway.
- [Gateway Watchdog](https://github.com/lab11/gateway/tree/master/software/gateway-watchdog-email):
Sends an email when the gateway stops getting new packets.
