Gateway
=======

Software for the Lab11 gateway platform.

<img src="https://www.gliffy.com/go/publish/image/10262809/L.png">

Goals
-----

This project has several goals:

1. Provide gatway layer functionality for a range of devices.
It should not be specific to just some projects.

2. Be as generic as possible. All device specific logic
should be developed elsewhere and pulled in only when
a relevant device is discovered.

3. Expose data streams in a low-friction manner.
This means making them available over common protocols
and in a self-describing data format.

4. Relay data streams to interested services. These could
be local to the gateway or cloud hosted endpoints.


Software Stack
--------------

The gateway stack is a series of discrete modules linked
by MQTT. Roughly, each folder in `/software` is a
separate module.

Parent Project
--------------

The gateway is being developed as a part of the
[Urban Heartbeat Kit Project](https://github.com/terraswarm/urban-heartbeat-kit).
More documentation on how to use a running gateway can be found there.



Related Projects
----------------

This is a list of other projects in the gateway vein. Some
have concepts that directly influenced this gateway design,
some are hardware platforms that this gateway supports, and others
just play a role in the gateway tier.

- **[IoT Gateway](https://github.com/lab11/iot-gateway)**: Leverage
smartphones to forward BLE advertisements.

- **[CloudComm](https://github.com/lab11/opo/tree/master/node)**: Eventual
data delivery to the cloud over BLE.

- **[PowerBlade](https://github.com/lab11/powerblade/tree/master/data_collection/advertisements)**:
Collect BLE advertisements from PowerBlade devices.

- **[GAP](https://github.com/lab11/gap)**: Add 802.15.4 hardware support
to the BeagleBone Black.

- **[Edison Based Gateway](https://github.com/lab11/IntelEdisonGateway)**: Gateway hardware
based on the Intel Edison.


