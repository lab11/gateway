COAP Gateway
====================

This is designed to be a modular gateway for devices using COAP.  Its core
principle is allowing devices to specify how to parse the data they provide and
what to do with that data.  It does this by allowing devices to specify their
own JavaScript functions that now how to take the data encoded in their packets
and format it into a JavaScript object. The gateway further allows devices to
provide JavaScript functions that know what to do with the parsed data.

Quick Overview
--------------

This script:

1. Waits for a COAP message to `/discovery` with a URL.
2. Upon receiving such a packet, it pulls out the embedded URL and uses
it to fetch a `parse_coap.js` file at `<URL>/parse_coap.js`. If the URL already specifies
a particular file, it removes the filename and uses just the base. For example,
if the URL is:

        http://example.com/folder/index.html

    the gateway will use just `http://example.com/folder/` and look for `parse_coap.js` at:

        http://example.com/folder/parse_coap.js
3. If that `parse_coap.js` file exists, the gateway will use the contained JavaScript functions
to parse other advertisements the device sends in the future.


To use this gateway with your COAP device
------------------------------------

1. Configure your device to periodically send (at least) a COAP discovery URL packet.
This packet should be formed as follows:


| 1 byte               | N bytes   | 1 byte         | M bytes |
| -------------------- | --------- | -------------- | ------- |
| Device ID length (N) | Device ID | URL Length (M) | URL     |


The URL should point to a webserver
path where you can host the needed JavaScript code. For example, the
URL should be a shortened version of something like:

        https://rawgit.com/org/project/device/

Packets besides the discovery packet
can be completely device specific. They can contain
data or not. The `parse_coap.js` is what the gateway will use
to parse data from these packets.

2. Create a `parse_coap.js` file and host it in the directory pointed to by the
Eddystone URL. For example:

        https://github.com/org/project/device/parse_coap.js

    See below for how to create the `parse_coap.js` file.



`parse_coap.js`
----------

A `parse_coap.js` file contains one or several functions that process advertisements
and devices that the gateway sees. When creating a `parse_coap.js` file, you only
need to implement and export the functions you wish to support. The gateway
will ignore missing functions.

The template of a `parse_coap.js` file looks like:

```js
// This function is called by the gateway when a non-Eddystone advertisement
// is received. The function should take the noble formatted advertisement,
// parse it into a JavaScript object, and call done() with that object.
// done() can also be called with a second optional object will only be used
// locally on the gateway. This can be used to store and share data that
// may be useful for interacting with the device, but should not be stored
// outside of the device.
var parsePayload = function (device_id, resource_url, payload, done) {};

// Only include here the functions you support. The gateway will only
// call the functions that are exported.
module.exports = {
    parsePayload: parsePayload,
};
```

One simple example of a `parse_coap.js` file might look like:

```js
var parse_payload = function (device_id, resource_url, payload, cb) {
    if(device_id != null) {
      var out = {
        device_id: device_id,
      }

      if (resource_url === '/resource') {
        out.resource = payload.readUint8();
      }

      cb(out);
      return;
    }

    cb(null);
}


module.exports = {
parsePayload: parse_payload
};
```

Extending the Gateway
---------------------

This gateway can run as a standalone application or as a module inside
of another tool. When running as a embedded module, it follows the
`EventEmitter` pattern allowing you to register callbacks for various
events.


```js
var CoapGateway = require('ble-gateway');

// Receive formatted advertisement data objects.
// adv_obj.id will be the peripheral id that it was captured from.
CoapGateway.on('payload', function (adv_obj) {
	...
});

// Get everything going.
CoapGateway.start();
```


Gateway Usage
-----

```
npm install
./ble-gateway.js
```
