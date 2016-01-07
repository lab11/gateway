var dgram = require('dgram');

var PORT = 3002;

var client = dgram.createSocket('udp4');

client.on('listening', function () {
    client.setBroadcast(true);
});

// On each message, print to the terminal
client.on('message', function (message, remote) {
	var adv_out = JSON.parse(message.toString());
    console.log(adv_out);
});

client.bind(PORT);
