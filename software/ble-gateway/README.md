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

2. Upon finding one, pulls out the URL and tries to fetch `<URL>/parse.js`.

3. If that exists, it uses the resulting JS file to parse other advertisements
the device sends in the future.


To use this gateway with your BLE device
------------------------------------

1. Configure your device to advertise two different advertisements.
One should be an Eddystone URL packet. The URL should point to a webserver
path where you can host the needed JavaScript code. For example, the Eddystone
URL should be a shortened version of something like:

        https://github.com/org/project/device/

    The second advertisement can be completely device specific. It can contain
    data or not. The second advertisement is what the gateway will use
    to parse data from the device.

    If you wish, you can advertise additional custom advertisements. Each will
    be passed to the same parse function, however.

2. Create a `parse.js` file and host it in the directory pointed to by the
Eddystone URL. For example:

        https://github.com/org/project/device/parse.js

    See below for how to create the `parse.js` file.



`parse.js`
----------

To create a `parse.js` file you simply implement the functions you wish to
support. The basic template looks like:

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


Extending the Gateway
---------------------

This gateway can run as a standalone application or as a module inside
of another tool.


```js

var BleGateway = require('BleGateway');

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
./advertisement-parse.js
```

Questions
---------

- How to let devices trigger common parsing functions (like Cloudcomm)?
Likely that a device will want to be able to use a common gateway function.

- Is there anyway to make downloading and running arbitrary JavaScript safe?


