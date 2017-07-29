Gateway to GDP
===================

This script takes data (right now just for signpost) and push it to a
GDP log of edu.berkeley.eecs.device_mac.version.data_stream_name

For example:
edu.berkeley.eees.c098e5120001.v0-0-1.signpost_ambient

It will create a log if that log doesn't exist. Right now we will
just be posting the JSON blobs that are being send to influx.

The configuration script with the username and password for the rest
server being used is in /etc/swarm-gateway/gdp.conf.

That file must contain the username and password for the GDP rest server
