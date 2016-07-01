BLE Address Sniffer
===================

This script listens for all BLE advertisements and outputs the
received BLE MAC addresses. It tries to do this in a privacy-preserving
way by hashing the addresses.

Usage
-----

```javascript
var BleAddrSniff = require('ble-address-sniffer');

// Run the sniffer
BleAddrSniff.start();

// Callback for when BLE discovers the advertisement
BleAddrSniff.on('advertisement', function (adv) {
    console.log(adv);
});
```

Example Packet
--------------

```
{
    globalHashedAddress: "a6",
    localHashedAddress: "10890adeca1688df8a739c7571502181cee5dc620b85dc8ce3d78762e175cdce",
    address: "c098e530005a",
    rssi: -76,
    receivedTime: "2016-03-13T06:10:44.264Z"
}
```

- `globalHashedAddress`: This is 8 bits of the hash of the MAC address.
It will be consistent across all gateways. However, as the hash space is
considerablly reduced, there will be collisions. The goal is to allow
devices to be tracked, but with some unpredictability, so true locations
are uncertain.
- `localHashedAddress`: This is a salted hash of the MAC address where the
salt is unique for each device and on each gateway. If you see the same
`localHashedAddress` you can be sure you saw the same BLE device. However,
devices cannot be tracked across gateways as each gateway will have different
salts.
- `address`: The actual MAC address. Here for obvious convenience, but should
be removed some day.
- `rssi`: Received signal strength indicator for the received packet.
