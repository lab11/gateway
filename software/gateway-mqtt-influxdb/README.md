Gateway to influxdb
===================

[InfluxDB](https://influxdata.com/) is a backend for time-series data.
This tool publishes the parsed advertisements to an influxdb installation.


Configuration
-------------

You must tell this tool where the influxdb instance is where the data should
be pushed to. To do this, create `/etc/swarm-gateway/influxdb.conf` and add:

    host = <host of influxdb server>
    database = <database to write data to>
    username = <username to authenticate with>
    password = <password to authenticate with>

Example:

    # /etc/swarm-gateway/influxdb.conf
    host = https://influxdb.umich.edu
    databse = mydata
    username = user
    password = secure

