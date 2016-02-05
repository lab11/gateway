Gateway Vision
==============

An IoT gateway must:
 * provide transfer of data to cloud
 * provide local connections for data
 * be device/manufacturer independent
 * update to handle new devices
 * provide local device discovery

An IoT gateway may:
 * host applications
 * provide application discovery
 * authorize device connections
 * collaborate with other gateways


In my view (Branden):

Standardizing on-device data formats is not going to happen. Everybody has
already started rolling their own structures and will continue to do so. What
we need is something equivalent to a driver. When you plug a microphone, mouse,
keyboard, or printer into your computer, the computer figures out how to
interact with them, even if they have more buttons or different functionality
than prior or similar devices. Device-specific drivers take whatever format the
data from the device is in, and manipulate it to fit standard profiles. This
does not discount the possibility of standardized on-device data formats. If a
device does support a standard profile, the driver for it will already have
been written, which is a boon to manufacturers.

Basically, we need something that lies between the access point (network
connection to IoT device) and the application (local or not) that will
translate data into a standard format. I'm arguing that this is not 

In order to enable this we need to (focused entirely on BLE and advertisements for now):
 1. Identify a device by its advertisement/scan response data
 2. Lookup an interface driver(s) for it

# WORK IN PROGRESS

### Interface drivers

First instinct: simple stateless data transformations

Do they need to be able to access previous state in order to provide useful current data?

Do they need to be able to access external resources?
    HTTP, TCP, etc.

What language are they in?

What is their input?
    An entire advertisement?
    A data type within an advertisement? (Service Data, Manufacturer Specific Data, Device Name, etc.)

What is their output?
    First instinct: JSON output of data


### Identifying devices

We want to be able to identify the device down to its manufacturer and its
specific type, possibly even a version of its firmware. This is dependent on
the device. Its conceivable for a Fitbit One and Fitbit Flex to have the same
advertisement data


### Determining the proper interface driver(s)

One or multiple? 

How are new ones created and uploaded

Who is allowed tu update a driver

What is the incentive to create these


## Supporting BLE Connections


