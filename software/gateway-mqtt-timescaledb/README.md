Gateway to timescaledb
===================

[TimescaleDB](https://timescale.com/) is a layer on top of postgresql
that allows for fast write ingestion and generally faster queries over
time series data. We want to be able to support the wide-table data model
because some of our devices are pushing the tag-set size limits of
influxdb. TimescaleDB is really just postgresql except for the addition
of an extra 'create_hypertable' call that specifies partitioning of
the time series data.

Configuration
-------------

You must tell this tool where the timescaledb instance is and pass in a username
and password. To do this, create `/etc/swarm-gateway/timescaledb.conf` and add:

    host = <host of influxdb server>
    port = <port of influxdb server>
    database = <database to write data to>
    username = <username to authenticate with>
    password = <password to authenticate with>

Example:

    # /etc/swarm-gateway/influxdb.conf
    host = timescaledb.lab11.eecs.umich.edu
    port = 5432
    database = sensor_data
    username = user
    password = secure
