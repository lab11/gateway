Ble Gateway
====================

This is designed to be a modular gateway for BLE devices.
Its core principle is allowing devices to specify how to parse the data
they provide and what to do with that data.
It does this by allowing devices to specify their own JavaScript functions
that now how to take the data encoded in their advertisements and services
and format it into a JavaScript object. The gateway further allows devices
to provide JavaScript functions that know what to do with the parsed data.



Quick Overview
--------------

This script:

1. Listens for Eddystone BLE advertisements.
2. Upon finding an Eddystone packet, it pulls out the embedded URL and uses
it to fetch a `parse.js` file at `<URL>/parse.js`. If the URL already specifies
a particular file, it removes the filename and uses just the base. For example,
if the Eddystone URL is:

        http://example.com/folder/index.html

    the gateway will use just `http://example.com/folder/` and look for `parse.js` at:

        http://example.com/folder/parse.js
3. If that `parse.js` file exists, the gateway will use the contained JavaScript functions
to parse other advertisements the device sends in the future.


To use this gateway with your BLE device
------------------------------------

1. Configure your device to advertise (at least) an Eddystone URL packet.
The URL should point to a webserver
path where you can host the needed JavaScript code. For example, the Eddystone
URL should be a shortened version of something like:

        https://rawgit.com/org/project/device/

    The scan response of that advertisement or a second advertisement
    can be completely device specific. It can contain
    data or not. This is what the gateway will use
    to parse data from the device.

    If you wish, you can advertise additional custom advertisements. Each will
    be passed to the same parse function, however.

2. Create a `parse.js` file and host it in the directory pointed to by the
Eddystone URL. For example:

        https://github.com/org/project/device/parse.js

    See below for how to create the `parse.js` file.



`parse.js`
----------

A `parse.js` file contains one or several functions that process advertisements
and devices that the gateway sees. When creating a `parse.js` file, you only
need to implement and export the functions you wish to support. The gateway
will ignore missing functions.

The template of a `parse.js` file looks like:

```js
// This function is called by the gateway when a non-Eddystone advertisement
// is received. The function should take the noble formatted advertisement,
// parse it into a JavaScript object, and call done() with that object.
var parseAdvertisement = function (advertisement, done) {};

// This function allows you to return an object with data collected from
// reading device services and characteristics. When this function is called,
// the gateway will pass in a noble peripheral object that is already connected.
// This function must read and services and characteristics that it wishes to
// and call done() with a JavaScript object.
var parseServices = function (peripheral, done) {};

// This function will be called with the parsed advertisement data and allows
// you to do something application specific with it.
var publishAdvertisement = function (adv_obj) {};

// This function allows you to publish formatted data from services.
var publishServiceData = function (data_obj) {};

// Only include here the functions you support. The gateway will only
// call the functions that are exported.
module.exports = {
    parseAdvertisement: parseAdvertisement,
    parseServices: parseServices,
    publishAdvertisement: publishAdvertisement,
    publishServiceData: publishServiceData,
};
```

The `advertisement` and `peripheral` parameters are objects
from the [noble](https://github.com/sandeepmistry/noble) BLE
library. For more information on how those objects are structured,
see the noble documentation.

One simple example of a `parse.js` file might look like:

```js
var parse_advertisement = function (advertisement, cb) {

    var name = advertisement.localName;
    var service_uuid = parseInt(advertisement.serviceData[0].uuid, 16);

    var out = {
        name: name,
        uuid: service_uuid
    };
    cb(out);
}

module.exports = {
    parseAdvertisement: parse_advertisement
};
```


Extending the Gateway
---------------------

This gateway can run as a standalone application or as a module inside
of another tool. When running as a embedded module, it follows the
`EventEmitter` pattern allowing you to register callbacks for various
events.


```js
var BleGateway = require('ble-gateway');

// Receive formatted advertisement data objects.
// adv_obj.id will be the peripheral id that it was captured from.
BleGateway.on('advertisement', function (adv_obj) {
	...
});

// Receive formatted objects from reading device services.
// data_obj.id will be the peripheral id that it was captured from.
BleGateway.on('data', function (data_obj) {
	...
});

// Get everything going.
BleGateway.start();
```


Gateway Usage
-----

```
npm install
./ble-gateway.js
```

Questions
---------

- How to let devices trigger common parsing functions (like Cloudcomm)?
Likely that a device will want to be able to use a common gateway function.
- Is there anyway to make downloading and running arbitrary JavaScript safe?
- How to specify what to do with the data?
- How to securely get a key off of the device to publish the data with?
- How to match formatted output data with a website publishing script?
