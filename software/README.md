Gateway Software
================

This folder contains all of the services that comprise
the gateway stack.

### Receivers

These receive data from devices:

- [BLE Gateway MQTT](ble-gateway-mqtt):
Listens for BLE advertisements and parses the ones that provide a `parse.js` file.
- [BLE Address Sniffer](ble-address-sniffer):
Listens for any BLE address and creates a data stream of <BLE Address, RSSI>.
- [802.15.4 Monjolo](ieee802154-monjolo-gateway):
Listens for any [Monjolo](https://github.com/lab11/monjolo) 15.4 packets and adds them to the data
stream.
- [802.15.4 Triumvi](ieee802154-triumvi-gateway):
Listens for 802.15.4 packets from an attached cc2538 radio or through a Linux socket. Used to collect
[Triumvi](https://github.com/lab11/g2) packets.
- [HTTP Watts Up?](http-wattsup-gateway):
Provide a webserver for listening for Watts Up? .net POST messages.

### Internal Services

These process data locally:

- [Gateway Publish](gateway-publish):
Takes the main MQTT stream and re-publishes it as UDP packets and as a WebSocket.
- [Gateway Server](gateway-server):
Display a status page for the gateway.

### Publishers

These take data and do something with it:

- [EmonCMS](gateway-mqtt-emoncms):
Publish to EmonCMS.
- [GATD](gateway-mqtt-gatd):
Publish to GATD.
- [InfluxDB](gateway-mqtt-influxdb):
Publish to an InfluxDB database.
- [Log](gateway-mqtt-log):
Write to a local text file log.
- [Sensu](gateway-mqtt-sensu):
Publish keepalives for each seen device to a Sensu monitoring server.

### Other

These provide other useful services:

- [Gateway BLE IP Advertisement](adv-gateway-ip):
Broadcast the gateway's IP address as a BLE packet.
- [BLE Nearby](ble-nearby):
Use nearby gateways to decide which devices are nearest to which gateway.
- [BLE Influx](ble-influx):
Collect raw BLE advertisements and directly post data to InfluxDB.
- [App Runner](app-runner):
Automatically start and restart scripts and other applications that make use
of the gateway's data.
- [DDNS](ddns):
Make the gateway publish to a BIND DNS server to register a hostname
for the gateway.
- [Gateway Internet LEDs](gateway-internet-leds):
Set LED color based on status of gateway.
- [Gateway Internet Reboot](gateway-internet-reboot):
Reboot the gateway if it looses its Internet connection.
- [Gateway MQTT Reboot](gateway-mqtt-reboot):
Reboot the gateway if it isn't getting parsed packets.

### Triumvi

A couple tools for Triumvi devices:

- [Triumvi BLE](gateway-triumvi-ble):
Re-broadcast Triumvi data as a BLE service.
- [Triumvi SQLite](gateway-triumvi-sqlite):
Store Triumvi packets localling in a SQLite database.
- [Triumvi Data Download](gateway-triumvi-server):
UI for downloading locally stored data.

## Requirements

In order to get a Gateway running with this software, follow the instructions at [Urban Heartbeat Kit](https://github.com/terraswarm/urban-heartbeat-kit)

For testing on Linux:

1. Install [node.js](https://nodejs.org/en/download/). If you are cool with
running a downloaded shell script as root you can do this on Ubuntu:

        curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
        sudo apt-get install -y nodejs

2. On Linux, make sure you have other dependencies installed:

        sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev avahi-daemon libavahi-compat-libdnssd-dev

    Also setup node.js so it can look for BLE packets without being root:

        sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)

3. Setup the dependencies for a script:

        cd software/<script name>
        npm install
