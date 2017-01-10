BLE to influxdb
===================

[InfluxDB](https://influxdata.com/) is a backend for time-series data.
This tool publishes BLE advertisement data to an influxdb installation.


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
