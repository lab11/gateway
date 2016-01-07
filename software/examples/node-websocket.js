var WebSocket = require('ws');

IP_ADDRESS = '141.212.11.53';
PORT = 3001;

var ws = new WebSocket('ws://' + IP_ADDRESS + ':' + PORT);

ws.on('message', function(data, flags) {
	var adv_out = JSON.parse(data);
	console.log(adv_out)
});
