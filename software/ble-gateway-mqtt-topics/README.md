BLE Gateway to MQTT Topics
==========================

Re-send the global stream `ble-gateway-advertisements` to individual
MQTT topics:

    device/<device type>/<device id>

For example:

    device/BLEES/c098e5300099


List Topics
-----------

You can see all valid `device` topics by listening to:

    ble-gateway-topics

Command:

    $ mosquitto_sub -h <mqtt broker ip address> -t ble-gateway-topics



Get all data for a type of sensor
---------------------------------

    $ mosquitto_sub -h <mqtt broker ip address> -t device/<device type>/+
