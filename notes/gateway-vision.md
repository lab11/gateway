Gateway Vision
==============

An IoT gateway needs to:
 * provide transfer of data to cloud
 * provide local connections for data
 * be device/manufacturer independent
 * update to handle new devices
 * provide local device discover

An IoT gateway might:
 * host applications
 * provide application discovery
 * authorize device connections
 * collaborate with other gateways


In my view (Branden):

Standardizing device data formats is not going to happen. Everybody has already
started rolling their own structures, and will continue to do so. What we need
is something equivalent to a driver. When you plug a microphone, mouse,
keyboard, or printer into your computer, the computer figures out interactions
with them, even if they have more buttons or different functionality than prior
devices. Device-specific drivers take whatever format the data from the device
is in, and manipulate it to fit standard profiles. This does not discount the
possibility of standardized device formats. If a device does support a standard
profile, the driver for it will already have been written.

Basically, we need something that lies between the access point (network
connection to IoT device) and the application (local or not) that will
translate data into a standard format.

An cloud service would allow searching for an IoT driver for a newly discovered
device.

How does this work in the driver world?



