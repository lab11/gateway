var dgram = require('dgram');

var PORT = 3002;

var client = dgram.createSocket('udp4');

client.on('listening', function () {
    client.setBroadcast(true);
});

// On each message, print to the terminal
client.on('message', function (message, remote) {
	var msg = message.toString();
    console.log(msg);
});

client.bind(PORT);
