#!/usr/bin/env node
/*

Takes the stream of packets from the BLE gateway and publishes them to
timescaledb.
*/

var argv        = require('minimist')(process.argv.slice(2));
var fs          = require('fs');
var ini         = require('ini');
var mqtt        = require('mqtt');
const { Pool }  = require('pg');
var format      = require('pg-format');
var flatten     = require('flat');

// Main data MQTT topic
var TOPIC_MAIN_STREAM = 'gateway-data';


// Read in the config file to get the parameters. If the parameters are not set
// or the file does not exist, we exit this program.
try {
    var config_file = fs.readFileSync('/etc/swarm-gateway/timescaledb.conf', 'utf-8');
    var config = ini.parse(config_file);
    if (config.host == undefined || config.host == '' ||
        config.database == undefined || config.database == '') {
        throw new Exception('no settings');
    }
} catch (e) {console.log(e)
    console.log('Could not find /etc/swarm-gateway/timescaledb.conf or timescaledb not configured.');
    process.exit(1);
}


// Add some reasonable defaults where needed
if (! ('port'     in config) ) config.port     = 5432;

// Let the command line override conf file settings
if ('host'     in argv) config.host     = argv.host;
if ('port'     in argv) config.port     = argv.port;
if ('database' in argv) config.database = argv.database;
if ('username' in argv) config.username = argv.username;
if ('password' in argv) config.password = argv.password;

const pg_pool = new  Pool( {
    user: config.username,
    host: config.host,
    database: config.database,
    password: config.password,
    port: config.port,
    max: 20,
})

console.log("Using timescale at " + config.host +
        ":" + config.port + "  db=" + config.database)

// Convert a field of the object coming from MQTT
// to a useful for format for publishing to TimescaleDB.
// This tries to convert standalone values to the correct TimescaleDB type,
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

function insert_data(device, timestamp, table_obj) {
    console.log("Insterting the data now!");
}

function create_table(device, timestamp, table_obj) {
    //how many rows is the table
    var cols = "";
    for (var key in table_obj) {
        cols = cols + ", %I %s";
    }

    //I think this can be done better with postgres internal data converter!!
    var names = [];
    names.push(device);
    for (var key in table_obj) {
        names.push(key);
        var meas = fix_measurement(table_obj[key])['value'];
        switch(typeof meas) {
        case "string":
            names.push('TEXT');
        break;
        case "boolean":
            names.push('BOOLEAN');
        break;
        case "number":
            names.push('DOUBLE PRECISION');
        break;
        }
    }
     
    console.log("Trying to create table!");
    //These are dynamic queries!!!
    //Which means the are prone to sql injection attacks
    //Postgres supports 'format' execution statements to prevent against this
    //but I can't get that to work, so I'm going to run it client-side
    //Therefore we are as safe as the node-pg-format library
    var qstring = format.withArray('CREATE TABLE %I (TIME TIMESTAMPTZ NOT NULL' + cols + ')',names);
    console.log(qstring);
    pg_pool.query(qstring, [], (err, res) => {
        if(err) {
            console.log(err)
        } else {
            //make it a hyptertable!
            pg_pool.query("SELECT create_hypertable($1,'time')",[device], (err, res) => {
                if(err) {
                    console.log(err)
                } else {
                    insert_data(device, timestamp, table_obj);
                }
            });
        }
    });
}

var mqtt_client;
function mqtt_on_connect() {
    console.log('Connected to MQTT ' + mqtt_client.options.href);

    mqtt_client.subscribe(TOPIC_MAIN_STREAM);

    // Called when we get a packet from MQTT
    mqtt_client.on('message', function (topic, message) {
        if (topic == TOPIC_MAIN_STREAM) {
            // message is Buffer
            var adv_obj = JSON.parse(message.toString());

            // Get device - This is going to be our table name
            var device = undefined;
            if ('device' in adv_obj) {
                device = adv_obj.device
            } 
            // Make sure the device id is only alpha numerical characters
            device.replace(/\W/g, '');

            //Get the timestamp - this is special because we are parititioning
            //over it
            var timestamp  = new Date(adv_obj['_meta']['received_time']).getTime();

            // Continue on to post to timescaledb
            if (device) {

                // Delete device and timestamp
                delete adv_obj.device;
                delete adv_obj._meta.received_time

                //Flatten the JSON object we go got the table, then remove
                //all the depth strings
                adv_copy = flatten(adv_obj);
                table_obj = {};
                for(var key in adv_copy) {
                    if(typeof adv_copy[key] != 'object') {
                        table_obj[key.split(".")[key.split(".").length -1]] = adv_copy[key];
                    }
                }

                // Only publish if there is some data
                if (Object.keys(table_obj).length > 0) {
                    //is there a table that exists for this device?
                    console.log("Checking for table!");
                    pg_pool.query("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)",[device], (err, res) => {
                        if (err) {
                            console.log(err);
                        } else {
                            console.log(res.rows[0].exists);
                            if(res.rows[0].exists == false) {
                                //create one
                                console.log('Calling create table');
                                create_table(device, timestamp, table_obj);
                            } else {
                                //it exists- post the data
                                insert_data(device, timestamp, table_obj);
                            }
                        }
                    });
                }
            }
        }
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
