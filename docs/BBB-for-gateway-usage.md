Using the BeagleBone Black - Gateway Version
============================================

The gateway is configured to accept data from many sensors
and distribute the data to many applications.

BLE Devices
-----------

Data from BLE devices is collected by the
[BleGateway](https://github.com/lab11/gateway/tree/master/software/ble-gateway)
core application. Devices which support this gateway point the gateway to a
device-specific "parser" JavaScript function that converts their BLE
advertisements to key,value JavaScript objects. Those objects are then
passed to subscribed applications.


