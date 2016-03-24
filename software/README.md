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

### Publishers

These take data and do something with it:

- [EmonCMS](https://github.com/lab11/gateway/tree/master/software/gateway-mqtt-emoncms):
Publish to EmonCMS.
- [GATD](https://github.com/lab11/gateway/tree/master/software/gateway-mqtt-gatd):
Publish to GATD.
- [Log](https://github.com/lab11/gateway/tree/master/software/gateway-mqtt-log):
Write to a local text file log.

### Other

These provide other useful services:

- [Gateway BLE IP Advertisement](https://github.com/lab11/gateway/tree/master/software/adv-gateway-ip):
Broadcast the gateway's IP address as a BLE packet.
- [BLE Nearby](https://github.com/lab11/gateway/tree/master/software/ble-nearby):
Use nearby gateways to decide which devices are nearest to which gateway.


## Requirements

In order to get a Gateway running with this software, follow the instructions at [Urban Heartbeat Kit](https://github.com/terraswarm/urban-heartbeat-kit)

For testing on Linux:

1. Install [node.js](https://nodejs.org/en/download/). If you are cool with
running a downloaded shell script as root you can do this on Ubuntu:

        curl -sL https://deb.nodesource.com/setup_5.x | sudo -E bash -
        sudo apt-get install -y nodejs

2. On Linux, make sure you have other dependencies installed:

        sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev avahi-daemon libavahi-compat-libdnssd-dev

    Also setup node.js so it can look for BLE packets without being root:

        sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)

3. Setup the dependencies for a script:

        cd software/<script name>
        npm install
