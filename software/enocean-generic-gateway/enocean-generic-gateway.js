#!/usr/bin/env node

// var exec = require('child_process').exec;
var fs   = require('fs');

// var async     = require('async');
var enocean    = require('node-enocean')();
var gatewayId  = require('lab11-gateway-id');
var mqtt       = require('mqtt');
var serialport = require('serialport');
var watchout   = require('watchout');
// var ini       = require('ini');

// var GatewayTopics = require('gateway-topics');



var MQTT_TOPIC_NAME = 'gateway-data';

var _mqtt_client = undefined;
var _gateway_id = '';

serialport.list(function (err, ports) {
  if (err) {
    console.log('Error reading serial ports.');
  } else {
    ports.forEach(function (port) {
      if (port.pnpId && port.pnpId.indexOf('EnOcean') != -1) {
        console.log('Using serial port ' + port.comName);
        gatewayId.id(function (addr) {
          _gateway_id = addr;

          _mqtt_client = mqtt.connect('mqtt://localhost');
          _mqtt_client.on('connect', function () {
            console.log('Connected to MQTT');
            enocean.listen(port.comName);
          });
        });
      }
    })
  }
});



enocean.on("ready", function () {
  console.log('Listening for EnOcean packets.');
  enocean.startLearning();
});

enocean.on("learned", function (data) {
	console.log('Learned about ' + data.eepType + '(' + data.id + ')');
});

enocean.on("known-data", function (data) {
	var out = {
		device: data.sensor.eepType,
		_meta: {
			received_time: new Date().toISOString(),
			device_id: data.sensor.id,
			receiver: 'enocean-generic-gateway',
			gateway_id: _gateway_id
		}
	};

  for (var shortname in data.data) {
    var item = data.data[shortname];
    // Skip any information about the learn bit.
    if (shortname.indexOf('LRN') != -1 || item.name.indexOf('Learn') != -1) {
      continue;
    }

    // Otherwise add this to the packet.
    var key = item.name;
    if (item.unit) {
      key += '_' + item.unit;
    }

    out[key] = item.value;
  }

  _mqtt_client.publish(MQTT_TOPIC_NAME, JSON.stringify(out));
});

enocean.on('learn-mode-stop', function (result) {
	// If for any reason learning stops, start it again!
	// Learning seems to stop for all sorts of reasons. Not good for a generic
	// gateway!
	enocean.startLearning();
});
