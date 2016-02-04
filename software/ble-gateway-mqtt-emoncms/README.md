Ble Gateway to Emoncms
======================

[EmonCMS](http://emoncms.org/) is a backend for power metering data. It can,
however, operate on any numeric timeseries data. This tool publishes the
parsed advertisements to an emoncms installation.

Configuration
-------------

You must tell this tool where the emoncms instance is where the data should
be pushed to. To do this, create `/etc/swarm-gateway/emoncms.conf` and add:

    url = <url of emoncms server>
    api_key = <write api key for instance>

Example:

	# /etc/swarm-gateway/emoncms.conf
    url = https://emoncms.umich.edu
    api_key = 78989ab9d9897120e4108da5b
