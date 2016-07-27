CC2538 802.15.4 Receiver
=======================

This receives 802.15.4 packets collected by an
attached CC2538 and publishes them to the `ieee802154-raw` MQTT topic.


Usage
-----

This script requires an attached CC2538, which only the Intel Edison gateway
supports at the moment.

The onboard CC2538 must first be programmed using the `triumviForward.bin`
binary image and flash script located
[here](https://github.com/lab11/IntelEdisonGateway/tree/master/Triumvi/cc2538/bin).

