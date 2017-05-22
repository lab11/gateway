#!/usr/bin/env node

var express = require('express');
var expressBodyParser = require('body-parser');

var gatewayId = require('lab11-gateway-id');
var mqtt = require('mqtt');

var GatewayTopics = require('gateway-topics');

var _app = express();
_app.use(expressBodyParser.urlencoded({extended: false}));

var MQTT_TOPIC_NAME = 'gateway-data';

// Get the ID for this gateway
var _gateway_id = '';
gatewayId.id(function (addr) {
    _gateway_id = addr;
});

// Need an MQTT broker to send to
var _mqtt_client = mqtt.connect('mqtt://localhost');

_app.post('/wattsup', function (req, res) {
	var out = {
		device:              'Watts Up .net',
		id:                  req.body.id,
		power_watts:         parseFloat(req.body.w)/10.0,
		voltage_volts:       parseFloat(req.body.v)/10.0,
		current_amps:        parseFloat(req.body.a)/10.0,
		energy_wh:           parseFloat(req.body.wh)/10.0,
		power_max_watts:     parseFloat(req.body.wmx)/10.0,
		voltage_max_volts:   parseFloat(req.body.vmx)/10.0,
		current_max_amps:    parseFloat(req.body.amx)/10.0,
		power_min_watts:     parseFloat(req.body.wmi)/10.0,
		voltage_min_volts:   parseFloat(req.body.vmi)/10.0,
		current_min_amps:    parseFloat(req.body.ami)/10.0,
		power_factor:        parseFloat(req.body.pf)/100.0,
		power_cycle:         parseFloat(req.body.pcy),
		frequency_hertz:     parseFloat(req.body.frq)/10.0,
		volt_amps:           parseFloat(req.body.va)/10.0,
		relay_on:            req.body.rnc === '0',
		tx_interval_seconds: parseFloat(req.body.sr),
		_meta: {
			received_time: new Date().toISOString(),
			device_id:     req.body.id,
			receiver:      'http-wattsup-gateway',
			gateway_id:    _gateway_id
		}
	};
	_mqtt_client.publish(MQTT_TOPIC_NAME, JSON.stringify(out));

	// Also publish on /device
    GatewayTopics.publish(out);

	// Keep the load on
	res.send('[0]')
});

_app.listen(8090, function () {
  console.log('Listening for wattsup on port 8090.');
});
