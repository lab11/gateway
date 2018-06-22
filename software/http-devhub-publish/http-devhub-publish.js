#!/usr/bin/env node

var fs        = require('fs');

var async     = require('async');
var argv      = require('minimist')(process.argv.slice(2));
var debug     = require('debug')('http-devhub-publish');
var ini       = require('ini');
var gatewayId = require('lab11-gateway-id');
var mqtt      = require('mqtt');
var request   = require('request');

var MQTT_TOPIC_NAME = 'gateway-data';

// Get the ID for this gateway
var _gateway_id = '';
gatewayId.id(function (addr) {
    _gateway_id = addr;
});

// Default config file path
var config_file = '/etc/swarm-gateway/devhub.conf';

// Check if the user wants to override that.
if ('config' in argv) {
    config_file = argv.config;
}

// Read in the config file to get the parameters. If the parameters are not set
// or the file does not exist, we exit this program.
try {
    var config_file = fs.readFileSync(config_file, 'utf-8');
    var config = ini.parse(config_file);
    if (config.api_key == undefined || config.api_key == '') {
        throw new Exception('no settings');
    }
} catch (e) {console.log(e)
    console.log('Could not find ' + config_file + ' or devhub not configured.');
    process.exit(1);
}

function main () {
    var devhub_sensors = {};

    // First fetch all of the sensors in the devhub database.
    debug('Fetching list of all sensors.');
    request('https://devhub.virginia.edu/api/'+config.api_key+'/sensors', function (error, response, body) {
        if (error) {
            console.log('error fetching sensors list')
            console.log(error);
            return;
        }
        if (response.statusCode != 200) {
            console.log('bad http response: ' + response.statusCode);
            return;
        }
        debug('Received list of all sensors.');

        var mqtt_client = mqtt.connect('mqtt://localhost');

        let sensors = JSON.parse(body);

        // Group them by building name into:
        // {
        //    building_name: [sensor1, sensor2]
        // }
        for (let sensor of sensors) {
            if (sensor.Name in devhub_sensors) {
                devhub_sensors[sensor.Name].push(sensor.Type);
            } else {
                devhub_sensors[sensor.Name] = [sensor.Type];
            }
        }

        // Iterate all buildings to get all sensor readings. Well, iterating all
        // buildings takes forever (on the order of 1.5 hours). So instead we
        // just capture buildings likely to be of interest.
        var buildings = Object.keys(devhub_sensors);
        debug('number of buildings: ' + buildings.length);
        var buildings_of_interest = [
            'ROTUNDA',
            'RICE HALL',
            'OLSSON HALL',
            'THORNTON HALL',
            'ALBERT H SMALL BUILDING',
            'HEATING PLANT',
            'CAVALIER SUBSTATION',
            'ALDERMAN SUBSTATION 15KV',
            'MATERIALS SCIENCE',
            'JOHN PAUL JONES ARENA',
        ];
        async.eachOfSeries(buildings_of_interest, function (building, i, callback) {
            // Skip buildings with "/" in their name for now as getting data from
            // them doesn't work.
            if (building.indexOf('/') > -1) {
                callback(null);
                return;
            }

            debug('Retrieving sensor readings for building: ' + building);

            var sensor_types = devhub_sensors[building];

            // Get functions to fetch all sensor readings for each building.
            var get_value_functions = [];
            for (let sensor_type of sensor_types) {
                if (sensor_type.length > 0) {
                    get_value_functions.push(get_sensor_data.bind(null, config.api_key, building, sensor_type))
                }
            }

            // Issue all of the sensor fetch requests in parallel.
            async.series(get_value_functions, function(err, results) {
                debug('Got all for a building.');
                // Results is a list of all the returns from `get_sensor_data`.

                var out = {};

                // Find the max time of the sensor readings. This will allow us
                // to ignore old measurements.
                var max_time = '';
                for (let measurement of results) {
                    if (measurement.time > max_time) {
                        max_time = measurement.time;
                    }
                }

                // Only add the measurements that are at that time.
                for (let measurement of results) {
                    if (measurement.time == max_time) {
                        out[measurement.key] = measurement.value;
                    }
                }

                // Add in the other fields that make the whole gateway system work.
                out.device = 'devhub';
                out._meta = {
                    received_time: max_time,
                    device_id: 1,
                    receiver: 'http-devhub-publish',
                    gateway_id: _gateway_id,
                    location_general: 'UVA',
                    location_specific: title_case(building)
                }

                mqtt_client.publish(MQTT_TOPIC_NAME, JSON.stringify(out));
                callback(null);
            });
        }, function () {
            // We're done looping in this function!
            debug('Finished retrieving data from buildings');
            mqtt_client.end();
        });
    });
}


function get_sensor_data (api_key, name, sensor, callback) {
    name = encodeURIComponent(name);
    sensor = encodeURIComponent(sensor);
    var request_url = 'https://devhub.virginia.edu/api/'+api_key+'/sensors/'+name+'/'+sensor+'/lastrecorded';
    // console.log(request_url)
    var request_obj = {
        uri: request_url,
        timeout: 30000,
    };
	request(request_obj, function (error, response, body) {
        if (error) {
            console.log(error)
            console.log(request_url)
        }
	  	// Result looks like:
        // {"Name":"ROTUNDA","Type":"Electric Demand","Value":20.8519,"Unit":"kW","Time":"2018-06-21T15:00:00.000Z"}
        try {
            data = JSON.parse(body);
            var key = data.Type.replace(/\s+/g, '_').toLowerCase() + '_' + data.Unit;
            callback(null, {'key':key, 'value':data.Value, 'time':data.Time});
        } catch (err) {
            console.log('JSON failed')
            console.log(body)
            console.log(request_url)
        }
	});
}

function title_case(str) {
    return str.replace(
        /\w\S*/g,
        function(txt) {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        }
    );
}

main();
// Run every 50 minutes.
setInterval(main, 50*60*1000);
