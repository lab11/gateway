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

function get_hash (addr, lat, lon) {
    if(typeof get_hash.hashes == 'undefined') {
        get_hash.hashes = {};
    }

    if(typeof lat !== 'undefined') {
        //this must have been a gps packet so let it update the hash table
        //is the  array defined
        if(typeof get_hash.hashes[addr] == 'undefined') {
            get_hash.hashes[addr].lat = [];
            get_hash.hashes[addr].lon = [];
            get_hash.hashes[addr].lat.push(lat)
            get_hash.hashes[addr].lon.push(lon)
            return Geohash.encode(lat,lon,11);
        }
        
        //first what is the current location?
        var latsum = get_hash.hashes[addr].lat.reduce((precivous, current) => current += previous);
        var latav = latsum/get_hash.hashes[addr].lat.length;
        var lonsum = get_hash.hashes[addr].lon.reduce((precivous, current) => current += previous);
        var lonav = lonsum/get_hash.hashes[addr].lon.length;
        var curhash = Geohash.encode(latav,lonav,7);
        var newhash = Geohash.encode(lat,lon,7);

        //is the newhash in or a neighbor of curhash?
        var neighborhash = Geohash.neighbours(curhash);
        var search = neighborhash.search(newhash);
        if(search != -1) {
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
            get_hash.hashes[addr].lat = [];
            get_hash.hashes[addr].lon = [];
            get_hash.hashes[addr].lat.push(lat)
            get_hash.hashes[addr].lon.push(lon)
        }


        var latsum = get_hash.hashes[addr].lat.reduce((precivous, current) => current += previous);
        var latav = latsum/get_hash.hashes[addr].lat.length;
        var lonsum = get_hash.hashes[addr].lon.reduce((precivous, current) => current += previous);
        var lonav = lonsum/get_hash.hashes[addr].lon.length;
        return Geohash.encode(latav,lonav,11);
    } else { 
        if(typeof get_hash.hashes[addr] == 'undefined') {
            return Geohash.encode(0,0,11);
        } else {
            var latsum = get_hash.hashes[addr].lat.reduce((precivous, current) => current += previous);
            var latav = latsum/get_hash.hashes[addr].lat.length;
            var lonsum = get_hash.hashes[addr].lon.reduce((precivous, current) => current += previous);
            var lonav = lonsum/get_hash.hashes[addr].lon.length;
            return Geohash.encode(latav,lonav,11);
        }
    }
}

function add_geohash (topic, buf) {
    if(topic == 'signpost-preproc/lab11/gps') {
        // GPS
        var day = buf.data.readUInt8(1);
        var month = buf.data.readUInt8(2);
        var year = buf.data.readUInt8(3);
        var hours = buf.data.readUInt8(4);
        var minutes = buf.data.readUInt8(5);
        var seconds = buf.data.readUInt8(6);
        var latitude = buf.data.readInt32BE(7)/(10000*100.0);
        var longitude = buf.data.readInt32BE(11)/(10000*100.0);
        var fix = ['', 'No Fix', '2D', '3D'][buf.data.readUInt8(15)];
        var satellite_count = buf.data.readUInt8(16);

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
mqtt_client.on('connect', function () {
    // Subscribe to all packets
    mqtt_client.subscribe('signpost-preproc/#');

    // Callback for each packet
    mqtt_client.on('message', function (topic, message) {
        var json = JSON.parse(message.toString());
        try {
            var pkt = add_geohash(topic,json);
            mqtt_client.publish('signpost/' + topic.slice(17), JSON.stringify(pkt));
        } catch (e) {
            console.log(e)
        }

    });
});
