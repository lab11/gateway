#!/usr/bin/env node

var fs     = require('fs');
var stream = require('stream');
var util   = require('util');

var log    = require('logrotate-stream');
var mqtt   = require('mqtt');
var ini    = require('ini');


var MQTT_TOPIC_NAME = 'gateway-data';
var DEFAULT_NUM_FILES = 5000;


// Read in the config file to get the log filename
try {
    var config_file = fs.readFileSync('/etc/swarm-gateway/log.conf', 'utf-8');
    var config = ini.parse(config_file);
    if (config.log_file == undefined || config.log_file == '') {
        throw new Exception('no settings');
    }
} catch (e) {
	console.log(e)
    console.log('Could not find /etc/swarm-gateway/log.conf or logging not configured.');
    process.exit(1);
}

var log_file = config.log_file;
console.log('Logging to ' + log_file);

if (config.num_files === undefined) {
	config.num_files = DEFAULT_NUM_FILES;
}
console.log('Logging up to ' + config.num_files + ' files.');

var GatewayStream = function () {
	stream.Readable.call(this);
	this.internal_queue = [];
	this.read_active = false;

	this.mqtt_client = mqtt.connect('mqtt://localhost');
	this.mqtt_client.on('connect', this.on_mqttBroker.bind(this));
};

util.inherits(GatewayStream, stream.Readable);


GatewayStream.prototype.on_mqttBroker = function () {
	console.log('Connected to MQTT ' + this.mqtt_client.options.href);

	// Subscribe to the main data topic
	this.mqtt_client.subscribe(MQTT_TOPIC_NAME);

	// Callback for when BLE discovers the advertisement
	this.mqtt_client.on('message', (topic, message) => {
	    this.internal_queue.push(message + '\n');
	    this.deliver();
	});
};

GatewayStream.prototype._read = function () {
	this.read_active = true;
	this.deliver();
};

GatewayStream.prototype.deliver = function () {
	if (this.read_active) {
		var ret = true;
		while (ret && this.internal_queue.length > 0) {
			ret = this.push(this.internal_queue.shift());
		}
		if (ret == false) {
			this.read_active = false;
		}
	}
}

var gateway_stream = new GatewayStream();
var logger = log({file: log_file,
                  size: config.file_size,
                  keep: parseInt(config.num_files),
                  compress: true});

logger.on('rotated', function () {
	console.log('Rotated log file.');
});

gateway_stream.pipe(logger);
