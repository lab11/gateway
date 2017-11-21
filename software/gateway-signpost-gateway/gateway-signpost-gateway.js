#!/usr/bin/env node

//
// Forward mqtt packets from lora gateway to local mqtt stream
// Convert from hex string to bytes
//

var child_process = require('child_process');
var fs            = require('fs');
var ini           = require('ini');
var mqtt          = require('mqtt');
var addr          = require('os').networkInterfaces();
var Geohash       = require('latlon-geohash');

// Read in the config file to get the parameters. If the parameters are not set
// or the file does not exist, we exit this program.
try {
    var config_file = fs.readFileSync('/etc/swarm-gateway/signpost-admin.conf', 'utf-8');
    var config = ini.parse(config_file);
    if (config.username == undefined || config.username == '' ||
        config.password == undefined || config.password == '') {
        throw new Exception('no settings');
    }
} catch (e) {console.log(e)
    console.log('Could not find /etc/swarm-gateway/signpost-admin.conf');
    process.exit(1);
}


function get_hash (addr, lat, lon) {
    if(typeof get_hash.hashes == 'undefined') {
        get_hash.hashes = {};
    }

    if(typeof lat !== 'undefined') {
        //this must have been a gps packet so let it update the hash table
        //is the  array defined
        if(typeof get_hash.hashes[addr] == 'undefined') {
            get_hash.hashes[addr] = {};
            get_hash.hashes[addr].lat = [];
            get_hash.hashes[addr].lon = [];
            get_hash.hashes[addr].lat.push(lat)
            get_hash.hashes[addr].lon.push(lon)
            console.log("New address")
            return Geohash.encode(lat,lon,11);
        }
        
        //first what is the current location?
        var latsum = get_hash.hashes[addr].lat.reduce((previous, current) => current += previous);
        var latav = latsum/get_hash.hashes[addr].lat.length;
        var lonsum = get_hash.hashes[addr].lon.reduce((previous, current) => current += previous);
        var lonav = lonsum/get_hash.hashes[addr].lon.length;
        var curhash = Geohash.encode(latav,lonav,7);
        var newhash = Geohash.encode(lat,lon,7);

        //is the newhash in or a neighbor of curhash?
        var neighborhash = Geohash.neighbours(curhash);
        var found = false;
        for(var key in neighborhash) {
            if(neighborhash[key] == newhash || curhash == newhash) {
                found = true;
            }
        }

        if(found) {
            console.log("Hash is a neighbor - averaging");
            //great it's a neighbor
            get_hash.hashes[addr].lat.push(lat)
            get_hash.hashes[addr].lon.push(lon)

            if(get_hash.hashes[addr].lon.length > 50) {
                get_hash.hashes[addr].lon.pop();
            }

            if(get_hash.hashes[addr].lat.length > 50) {
                get_hash.hashes[addr].lat.pop();
            }

        } else {
            //not a neighbor - restart
            console.log("Hash not a neighbor - clearing");
            get_hash.hashes[addr].lat = [];
            get_hash.hashes[addr].lon = [];
            get_hash.hashes[addr].lat.push(lat)
            get_hash.hashes[addr].lon.push(lon)
        }


        var latsum = get_hash.hashes[addr].lat.reduce((previous, current) => current += previous);
        var latav = latsum/get_hash.hashes[addr].lat.length;
        var lonsum = get_hash.hashes[addr].lon.reduce((previous, current) => current += previous);
        var lonav = lonsum/get_hash.hashes[addr].lon.length;
        return Geohash.encode(latav,lonav,11);
    } else { 
        if(typeof get_hash.hashes[addr] == 'undefined') {
            return Geohash.encode(0,0,11);
        } else {
            var latsum = get_hash.hashes[addr].lat.reduce((previous, current) => current += previous);
            var latav = latsum/get_hash.hashes[addr].lat.length;
            var lonsum = get_hash.hashes[addr].lon.reduce((previous, current) => current += previous);
            var lonav = lonsum/get_hash.hashes[addr].lon.length;
            return Geohash.encode(latav,lonav,11);
        }
    }
}

function add_geohash (topic, buf) {
    if(topic == 'signpost-preproc/lab11/gps') {
        // GPS
        var day = buf.data.data[1];
        var month = buf.data.data[2];
        var year = buf.data.data[3];
        var hours = buf.data.data[4];
        var minutes = buf.data.data[5];
        var seconds = buf.data.data[6];
        var latitude = ((buf.data.data[7] << 24) + (buf.data.data[8] << 16) + (buf.data.data[9] << 8) + (buf.data.data[10]))/(10000*100.0);
        var longitude = ((buf.data.data[11] << 24) + (buf.data.data[12] << 16) + (buf.data.data[13] << 8) + (buf.data.data[14]))/(10000*100.0);
        var fix = ['', 'No Fix', '2D', '3D'][buf.data.data[15]];
        var satellite_count = buf.data.data[16];

        if (year >= 80) {
          year += 1900;
        } else {
          year += 2000;
        }
        
        buf.geohash = get_hash(buf.device_id,latitude,longitude);
    } else {
        buf.geohash = get_hash(buf.device_id);
    }

    return buf;
}    

var mqtt_client = mqtt.connect('mqtt://localhost');
var mqtt_external = mqtt.connect('mqtt://localhost:8883',{username: config.username, password: config.password});

mqtt_client.on('connect', function () {
    // Subscribe to all packets
    mqtt_client.subscribe('signpost-preproc/#');

    // Callback for each packet
    mqtt_client.on('message', function (topic, message) {
        var json = JSON.parse(message.toString());
        try {
            var pkt = add_geohash(topic,json);
            mqtt_external.publish('signpost/' + pkt.device_id + topic.slice(17), JSON.stringify(pkt));
        } catch (e) {
            console.log(e)
        }

    });
});
