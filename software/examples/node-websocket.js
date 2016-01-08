var WebSocket = require('ws');

HOST = '127.0.0.1';
PORT = 3001;

var ws = new WebSocket('ws://' + HOST + ':' + PORT);

ws.on('message', function(data, flags) {
	var adv_out = JSON.parse(data);
	console.log(adv_out)
});
