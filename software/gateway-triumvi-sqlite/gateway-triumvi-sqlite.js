#!/usr/bin/env node

var fs     = require('fs');

var sqlite3 = require('sqlite3');
var mqtt    = require('mqtt');
var ini     = require('ini');


var MQTT_TOPIC_NAME = 'device/Triumvi/+';


// SQL
var CREATE_TABLE = '\
CREATE TABLE IF NOT EXISTS triumvi (\
  TRIUMVI_ID        CHAR(16) NOT NULL,\
  TIMESTAMP         INT      NOT NULL,\
  POWER_WATTS       REAL     NOT NULL,\
  POWER_FACTOR      REAL     NOT NULL,\
  VOLTAGE_RMS_VOLTS REAL     NOT NULL,\
  CURRENT_RMS_AMPS  REAL     NOT NULL,\
  PANEL_ID          INT,\
  CIRCUIT_ID        INT\
)\
';

var INSERT = 'INSERT INTO triumvi VALUES (?, ?, ?, ?, ?, ?, ?, ?)';



// Read in the config file to get the sqlite db filename
try {
    var config_file = fs.readFileSync('/etc/swarm-gateway/triumvi-sqlite.conf', 'utf-8');
    var config = ini.parse(config_file);
    if (config.database_file == undefined || config.database_file == '') {
        throw new Exception('no settings');
    }
} catch (e) {
	console.log(e)
    console.log('Could not find /etc/swarm-gateway/triumvi-sqlite.conf or not configured correctly.');
    process.exit(1);
}


// Do the actual saving to DB
var db = new sqlite3.Database(config.database_file);

db.run(CREATE_TABLE, function (err) {
	if (err) {
		console.log('Error creating table.');
		console.log(err);
	} else {
		console.log('Created table!');

		// Get the MQTT connection
		var mqtt_client = mqtt.connect('mqtt://localhost');
		mqtt_client.on('connect', function () {
			// Setup database insert statement
			var insert = db.prepare(INSERT);

			// Subscribe to all Triumvi packets
			mqtt_client.subscribe(MQTT_TOPIC_NAME);

			// Callback for each Triumvi packet
			mqtt_client.on('message', (topic, message) => {
				try {
					var pkt = JSON.parse(message);

					var triumvi_id = pkt._meta.device_id;
					var timestamp = new Date(pkt._meta.received_time);
					var power_watts = pkt.power_watts;
					var power_factor = pkt.power_factor;
					var voltage_rms_volts = pkt.voltage_rms_volts;
					var current_rms_amps = pkt.current_rms_amps;
					var panel_id = pkt.panel_id;
					if (panel_id === 'undefined') panel_id = null;
					var circuit_id = pkt.circuit_id;
					if (circuit_id === 'undefined') circuit_id = null;

					// Insert into database
					insert.run(triumvi_id,
					           timestamp,
					           power_watts,
					           power_factor,
					           voltage_rms_volts,
					           current_rms_amps,
					           panel_id,
					           circuit_id);
				} catch (e) {
					console.log('Skipping packet: ' + e);
				}
			});
		});
	}
})
