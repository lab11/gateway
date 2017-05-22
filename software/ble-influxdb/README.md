BLE to influxdb
===================

[InfluxDB](https://influxdata.com/) is a backend for time-series data. This
tool collects raw BLE advertisements and publishes their device type (BLEES,
PowerBlade, etc.), BLE address, RSSI, receive time, and sequence number to an
influxdb installation. In order to determine the device type and the sequence
number (where applicable), this service uses the fourth octet of the BLE
address.

Whereas `ble-gateway-mqtt` translates data in the advertisement and makes that
data available to the gateway, this service does not care about the data in the
advertisement, only the existence of the advertisement itself. This service is
used to study reception rates of raw BLE packets.


Configuration
-------------

You must tell this tool where the influxdb instance is where the data should
be pushed to. To do this, create `/etc/swarm-gateway/influxdb.conf` and add:

    host = <host of influxdb server>
    port = <port of influxdb server>
    database = <database to write data to>
    protocol = <http|https>
    username = <username to authenticate with>
    password = <password to authenticate with>
    prefix = <path to prepend to `write` API requests>

Example:

    # /etc/swarm-gateway/influxdb.conf
    host = https://influxdb.umich.edu
    port = 8086
    protocol = http
    database = mydata
    username = user
    password = secure
    prefix = gateway/
