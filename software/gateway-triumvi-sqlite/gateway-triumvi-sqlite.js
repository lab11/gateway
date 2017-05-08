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
  POWER_FACTOR      REAL             ,\
  VOLTAGE_RMS_VOLTS REAL             ,\
  CURRENT_RMS_AMPS  REAL             ,\
  INA_GAIN          INT              ,\
  PANEL_ID          INT              ,\
  CIRCUIT_ID        INT              ,\
  THREE_PHASE       INT              ,\
  FRAM_WRITE        INT              ,\
  SAMPLE_TIMESTAMP  INT              ,\
  COUNTER           INT               \
)\
';

var INSERT = 'INSERT INTO triumvi VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)';


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

function ornull (val) {
	if (val === 'undefined') return null;
	return val;
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

					var triumvi_id        = pkt._meta.device_id;
					var timestamp         = new Date(pkt._meta.received_time);
					var power_watts       = pkt.power_watts;
					var power_factor      = ornull(pkt.power_factor);
					var voltage_rms_volts = ornull(pkt.voltage_rms_volts);
					var current_rms_amps  = ornull(pkt.current_rms_amps);
					var ina_gain          = ornull(pkt.ina_gain);
					var panel_id          = ornull(pkt.panel_id);
					var circuit_id        = ornull(pkt.circuit_id);
					var three_phase       = ornull(pkt.three_phase_meter);
					var fram_write        = ornull(pkt.fram_write);
					if (pkt.sample_timestamp === 'undefined') {
						var sample_timestamp = null;
					} else {
						var sample_timestamp = new Date(pkt.sample_timestamp);
					}
					var counter           = ornull(pkt.counter);

					// Insert into database
					insert.run(triumvi_id,
					           timestamp,
					           power_watts,
					           power_factor,
					           voltage_rms_volts,
					           current_rms_amps,
					           ina_gain,
					           panel_id,
					           circuit_id,
					           three_phase,
					           fram_write,
					           sample_timestamp,
					           counter);
				} catch (e) {
					console.log('Skipping packet: ' + e);
				}
			});
		});
	}
});
