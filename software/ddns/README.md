Dynamic DNS
===========

_Note: This README covers `software/ddns` and `cron/ddns`_

Dynamic DNS will automatically update a DNS server with the current IP of this
device. This uses the standard Dynamic DNS Update requests as defined in RFC
2136, and thus should work with any standard DNS server.

Currently, devices will automatically register themselves with a DNS entry of
`MAC_ADDRESS.device.lab11.eecs.umich.edu`.


Requirements
------------

You will need Python3, the `dnspython3` package for Python3, and the `nsupdate`
utility, which is found in `dnsutils` in `apt`.


Configuration
-------------

You will first need to configure the DNS server,
[see instructions here](https://github.com/terraswarm/urban-heartbeat-kit/blob/master/docs/gateway-setup-scratch-common.md#optional-set-up-dynamic-dns).

The rest of the configuration is currently hardcoded in the cron script, as
arguments to the `ddns.py` utiltity. It expects that the ddns keys are
available at `/etc/swarm-gateway/ddns/`.

