var mqtt = require('mqtt');

var HOST = '127.0.0.1';

var client = mqtt.connect('mqtt://' + HOST);

client.on('connect', function () {
    client.subscribe('ble-gateway-advertisements');
});

client.on('message', function (topic, message) {
    // message is Buffer
    var adv_obj = JSON.parse(message.toString());
    console.log(adv_obj);
});
