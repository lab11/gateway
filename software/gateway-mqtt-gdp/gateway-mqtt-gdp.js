#!/usr/bin/env node
/*

Takes the stream of packets from the BLE gateway and publishes them to
influxdb.
*/

var argv         = require('minimist')(process.argv.slice(2));
var fs           = require('fs');
var ini          = require('ini');
var mqtt         = require('mqtt');
var XMLHttpRequest  = require('xmlhttprequest').XMLHttpRequest;
var btoa         = require('btoa');

// Main data MQTT topic
var TOPIC_MAIN_STREAM = 'gateway-data';

// Read in the config file to get the parameters. If the parameters are not set
// or the file does not exist, we exit this program.
try {
    var config_file = fs.readFileSync('/etc/swarm-gateway/gdp.conf', 'utf-8');
    var config = ini.parse(config_file);
} catch (e) {console.log(e)
    console.log('Could not find /etc/swarm-gateway/influxdb.conf or influxdb not configured.');
}

if(!config.username || !config.password) {
    console.log('Must have a conf file with username and password');
    process.exit(1);
}

// Convert a field of the object coming from MQTT
// to a useful for format for publishing to InfluxDB.
// This tries to convert standalone values to the correct InfluxDB type,
// and creates a multi-element measurement if the field is an object.
function fix_measurement (field) {

    function fix_measurement_no_objects (subfield) {
        if (typeof subfield === 'object') {
            return JSON.stringify(field);
        } else if (subfield === null) {
            return 'null';
        } else if (typeof subfield === 'number') {
            return subfield;
        } else if (typeof subfield === 'boolean') {
            return subfield;
        } else if (typeof subfield === 'string') {
            if (field.lower() === 'true') {
                return true;
            } else if (field.lower() === 'false') {
                return false;
            } else if (isFloat(field)) {
                parseFloat(field);
            } else {
                return field;
            }
        } else {
            return JSON.stringify(field);
        }
    }

    // Taken from https://github.com/chriso/validator.js/blob/master/lib/isFloat.js
    function isFloat (str) {
        var float = /^(?:[-+]?(?:[0-9]+))?(?:\.[0-9]*)?(?:[eE][\+\-]?(?:[0-9]+))?$/;

        if (str === '' || str === '.') {
            return false;
        }
        return float.test(str);
    }

    if (Array.isArray(field)) {
        // We cannot pass an array to Influx, so we must make it a string
        // before sending it to Influx.
        return JSON.stringify(field);
    } else if (field === null) {
        // There is no "null" type in Influx, not really sure what the user
        // wants, so lets send a string. Seems better than forcing it to a
        // bool.
        return 'null';
    } else if (typeof field === 'object') {
        // Want to pass this as a complex measurement. Otherwise we would
        // try to store "[object object]".
        var out = {};
        for (var key in field) {
            out[key] = fix_measurement_no_objects(field[key]);
        }
        return out;
    } else if (typeof field === 'number') {
        // A number will get stored as a float.
        return {value: field};
    } else if (typeof field === 'boolean') {
        // Booleans are OK too.
        return {value: field};
    } else if (typeof field === 'string') {
        // Strings are fine, but we want to promote things which are obviously
        // bools or numbers to the proper type.
        if (field.toLowerCase() === 'true') {
            // Check for any of 'true', 'True', 'TRUE', etc.
            return {value: true};
        } else if (field.toLowerCase() === 'false') {
            return {value: false};
        } else if (isFloat(field)) {
            // If this looks like a valid number, make it an actual number.
            // Since JS doesn't really do integers, and the influx publishing
            // library doesn't use the integer data type, no need to bother
            // worrying about if the number is an integer or not.
            return {value: parseFloat(field)};
        } else {
            // Well, guess it's just a string!
            return {value: field};
        }
    } else {
        // Based on the allowed types in a JSON, we should never get to
        // this case.
        console.log('Error parsing type (' + typeof field + ') of: ' + field);
        return {value: JSON.stringify(field)};
    }

}


var mqtt_client;
function mqtt_on_connect() {
    console.log('Connected to MQTT ' + mqtt_client.options.href);

    if(typeof(mqtt_on_connect.known_logs) == 'undefined') {
        mqtt_on_connect.known_logs = {};
    }

    mqtt_client.subscribe(TOPIC_MAIN_STREAM);

    // Called when we get a packet from MQTT
    mqtt_client.on('message', function (topic, message) {
        start = new Date().getTime();
        if (topic == TOPIC_MAIN_STREAM) {
            // message is Buffer
            var adv_obj = JSON.parse(message.toString());

            console.log("Received post from topic " + topic);

            // Get device id
            var device_id = undefined;
            if ('_meta' in adv_obj) {
                device_id = adv_obj._meta.device_id;
            } else if ('id' in adv_obj) {
                device_id = adv_obj.id;
            }

            // Make sure the device id is only alpha numerical characters
            device_id.replace(/\W/g, '');

            var device_class = adv_obj['device'];
            delete adv_obj.device;

            var timestamp  = new Date(adv_obj['_meta']['received_time']).getTime();

            // Continue on to post to influxdb
            if (device_id) {

                // Add all keys that are in the _meta field to the
                // tags section of the stored packet.
                var tags = {};
                for (var key in adv_obj['_meta']) {
                    tags[key] = adv_obj['_meta'][key];
                }

                tags.device_id = device_id;
                tags.device_class = device_class;

                // Delete meta key and possible id key
                delete adv_obj.id;
                delete adv_obj._meta;

                // Only publish if there is some data
                if (Object.keys(adv_obj).length > 0) {
                    for (var key in adv_obj) {
                        adv_obj[key] = fix_measurement(adv_obj[key]);
                    }
                }

                log_name = 'edu.berkeley.eecs.' + device_id + '.' + device_class + '.v0-0-1'
                
                if(tags.device_id) {
                    delete tags.device_id;
                }

                if(tags.device_class) {
                    delete tags.device_class;
                }
                
                adv_obj._meta = tags;
                
                //create the gcl name (it might already exist)
                if(typeof mqtt_on_connect.known_logs[log_name] == 'undefined') {
                    name = {"external-name": log_name}
                    var request = new XMLHttpRequest();
                    request.timeout = 5000;
                    request.open("PUT", "https://gdp-rest-01.eecs.berkeley.edu/gdp/v1/gcl", true);
                    request.onload = function () {
                        if(request.readyState === 4) {
                            console.log("Received log creation reply");
                            try {
                                response = JSON.parse(request.responseText);
                            } catch (e) {
                                console.log(e);
                                console.log(request.responseText);
                            }
                            if(response.code) {
                                if(response.code == "409") {
                                    console.log("GCL already exists");
                                    mqtt_on_connect.known_logs[log_name] = "";
                                }
                            }

                            //post the data to the new gdp
                            var req = new XMLHttpRequest();
                            req.timeout = 5000;
                            req.open("POST", "https://gdp-rest-01.eecs.berkeley.edu/gdp/v1/gcl/" + log_name, true);
                            req.onload = function () {
                                if(req.readyState === 4) {
                                    console.log("Received append reply");
                                    try {
                                        response = JSON.parse(req.responseText);
                                        console.log(response);
                                    } catch (e) {
                                        console.log(e);
                                        console.log(req.responseText);
                                    }
                                }
                            };
                            request.onerror = function () {
                              console.log(req.statusText);
                            };

                            req.setRequestHeader('Content-Type', 'application/json');
                            req.setRequestHeader("Authorization", "Basic " + btoa(config.username+':'+config.password));
                            console.log("Sending append request");
                            req.send(JSON.stringify(adv_obj));
                        }
                    };
                    request.onerror = function () {
                      console.log(request.statusText);
                    };
                    request.setRequestHeader('Content-Type', 'application/json');
                    request.setRequestHeader("Authorization", "Basic " + btoa(config.username+':'+config.password));
                    console.log("Sending log creation request");
                    request.send(JSON.stringify(name));
                    
                } else {
                    //post the data to the new gdp
                    var request = new XMLHttpRequest();
                    request.timeout = 5000;
                    request.open("POST", "https://gdp-rest-01.eecs.berkeley.edu/gdp/v1/gcl/" + log_name, true);
                    request.onload = function () {
                        if(request.readyState === 4) {
                            console.log("Received append reply");
                            try {
                                response = JSON.parse(request.responseText);
                                console.log(response);
                            } catch (e) {
                                console.log(e);
                                console.log(request.responseText);
                            }
                        }
                    };
                    request.onerror = function () {
                      console.log(request.statusText);
                    };

                    request.setRequestHeader('Content-Type', 'application/json');
                    request.setRequestHeader("Authorization", "Basic " + btoa(config.username+':'+config.password));
                    console.log("Sending append request");
                    request.send(JSON.stringify(adv_obj));
                }
            }
        }
        end = new Date().getTime();
        console.log(end - start);
    });
};


if ('remote' in argv) {
    var mqtt_url = 'mqtt://' + argv['remote'];
} else {
    var mqtt_url = 'mqtt://localhost';
}
console.log("Connecting to " + mqtt_url);

mqtt_client = mqtt.connect(mqtt_url);
mqtt_client.on('connect', mqtt_on_connect, mqtt_client);
