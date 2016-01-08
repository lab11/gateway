Using the BeagleBone Black - Gateway Version
============================================

The gateway is configured to accept data from many sensors
and distribute the data to many applications.

Find the IP Address of the BBB
------------------------------

The first step is to find the IP address of the BBB. To help with this,
the BBB is broadcasting over BLE its IP address. To read the IP address:

- **Android**: Download the [Summon](https://play.google.com/store/apps/details?id=edu.umich.eecs.lab11.summon)
app or the [Nordic BLE App](https://play.google.com/store/apps/details?id=no.nordicsemi.android.mcp)
and look for a device with the name "Beaglebone". Both apps will display the IP address.
- **Mac OS X**: Don't have a super easy option here. Apple provides some
[tools](https://www.google.com/search?q=mac+os+x+hardware+io+tools&ie=utf-8&oe=utf-8)
but they are pretty low-level.
- **Linux**: Don't have a good solution here. Nmap may work: `nmap -sV -p22 <your ip address>/24`.
- **iOS**: BLE scanning apps exist, but they don't support Eddystone. You can use one
and covert the raw bytes to an ASCII IP address yourself if you wish....

Getting Data from BLE Devices On Your Computer
----------------------------------------------

Data from BLE devices is collected by the
[BleGateway](https://github.com/lab11/gateway/tree/master/software/ble-gateway)
core application which runs on the BBB by default. Devices which support
this gateway point the gateway to a
device-specific "parser" JavaScript function that converts their BLE
advertisements to key,value JavaScript objects. Those objects are then
passed to subscribed applications.

You can access these packets over a couple protocols once you know
the IP address of the BBB gateway (or if you are on the same
LAN). For code examples, look
[here](https://github.com/lab11/gateway/tree/master/software/examples).

- **Quick View**

    To view a very simple UI with the recent data, go to:

        http://<ip address of the BBB>
    
    This will display all of the devices the gateway has seen and their
    last ten packets.

- **WebSockets**

    To retreive as a websocket stream, connect a websocket client to

        ws://<ip address of the BBB>:3001
    
    All packets the gateway sees will be sent to each client connected
    via websockets.

    - **Ptolemy**

        To get packets from the gateway to Ptolemy, add a `WebSocketClient`
        accessor with the IP address of the BBB as the `server` field and
        3001 as the `port` field.

- **MQTT**

    To retreive data from a MQTT topic, install MQTT and run:

        mosquitto_sub -h <ip address of the BBB> -t ble-gateway-advertisements

- **UDP Broadcast**

    Packets are sent as JSON encoded strings in UDP packets to the broadcast
    address `255.255.255.255` on port `3002`.


