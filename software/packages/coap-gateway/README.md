COAP Gateway
====================

This is designed to be a modular gateway for devices using COAP.  Its core
principle is allowing devices to specify how to parse the data they provide and
what to do with that data.  It does this by allowing devices to specify their
own protobuf specification that defines how to decode the data in their
packets and format it into a JavaScript object.

Quick Overview
--------------

This script:

1. Waits for a COAP message to `/discovery` with a URL.
2. Upon receiving such a packet, it pulls out the embedded URL and uses
it to fetch a `parse.proto` file at `<URL>/parse.proto`. If the URL already specifies
a particular file, it removes the filename and uses just the base. For example,
if the URL is:

        http://example.com/folder/index.html

    the gateway will use just `http://example.com/folder/` and look for `parse.proto` at:

        http://example.com/folder/parse.proto
3. If that `parse.proto` file exists, the gateway will use the protobuf definition
to parse other messages the device sends in the future.


To use this gateway with your COAP device
------------------------------------

1. Configure your device to periodically send a COAP discovery URL packet, or
   respond with one when presented with a 4.04 status (Not Found).

This packet should be formed as follows:


| 1 byte               | N bytes   | 1 byte         | M bytes |
| -------------------- | --------- | -------------- | ------- |
| Device ID length (N) | Device ID | URL Length (M) | URL     |


The URL should point to a webserver
path where you can host the needed protobuf file. For example, the
URL should be a shortened version of something like:

        https://org.github.io/project/device/

Packets besides the discovery packet
can be completely device specific. They can contain
data or not. The `parse.proto` is what the gateway will use
to parse data from these packets.

2. Create a `parse.proto` file and host it in the directory pointed to by the
discovery packet URL. For example:

        https://org.github.io/project/device/parse.proto

    See below for how to create the `parse.proto` file.



`parse.proto`
----------

A `parse.proto` file contains the protobuf packet definition.
The template of a `parse.proto` file looks like:

```proto
syntax = "proto3";

message Header {
  uint32 version = 1;
  bytes  id = 2;
  string device_type = 3;
  uint32 seq_no = 4;
  uint64 tv_sec = 5;
  uint32 tv_usec = 6;
}
message Data {
  string discovery = 1;
  string git_version = 2;

  // Add your custom definitions here
}

message Message {
  Header header = 1;
  Data data = 2;
}

```

One simple example of a `parse.proto` file might look like:

```proto
syntax = "proto3";

message Header {
  uint32 version = 1;
  bytes  id = 2;
  string device_type = 3;
  uint32 seq_no = 4;
  uint64 tv_sec = 5;
  uint32 tv_usec = 6;
}
message Data {
  string discovery = 1;
  string git_version = 2;

  float temperature_c = 10;
  float pressure_mbar = 11;
  float humidity_percent = 12;
  float light_lux = 13;
  bool  motion = 14;
}

message Message {
  Header header = 1;
  Data data = 2;
}
```

Extending the Gateway
---------------------

This gateway can run as a standalone application or as a module inside
of another tool. When running as a embedded module, it follows the
`EventEmitter` pattern allowing you to register callbacks for various
events.


```js
var CoapGateway = require('coap-gateway');

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
./coap-gateway.js
```
