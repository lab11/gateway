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
var express       = require('express');
var expressBodyParser       = require('body-parser');


function pad (s, len) {
    for (var i=s.length; i<len; i++) {
        s = '0' + s;
    }
    return s;
}

function get_hash (addr, hash) {
    if(typeof get_hash.hashes == 'undefined') {
        get_hash.hashes = {};
    }

    if(typeof hash !== 'undefined') {
        //this must have been a gps packet so let it update the hash table
        get_hash.hashes[addr] = hash;
        return hash;
    } else { 
        if(typeof get_hash.hashes[addr] == 'undefined') {
            return Geohash.encode(0,0,10);
        } else {
            return get_hash.hashes[addr];
        }
    }
}

function parse (buf) {
    // Strip out address
    var addr = '';
    for (var i=0; i<6; i++) {
        addr += pad(buf[i].toString(16), 2);
    }
    
    var sequence_number = buf.readUInt8(6);
    
    var done = false;
    var index = 7;
    var pcount = 0;
    var ret = {};
    while(done == false) {
        var total_len = buf.readUInt16BE(index);
        index += 2;
        var start_index = index;
        var tlen = buf.readUInt8(index);
        if(tlen + 3 > total_len) {
            console.log("Length parsing error - continueing");
            index = start_index + total_len;
            continue;
        }

        console.log("Topic length is: " + tlen);
        index += 1;
        var topic = buf.toString('utf-8',index, index+tlen);
        index += tlen;
        var dlen = buf.readUInt16BE(index);
        if(tlen + dlen + 3 > total_len) {
            console.log("Length parsing error - continueing");
            index = start_index + total_len;
            continue;
        }

        console.log("Data length is: " + dlen);
        index += 2;
        var data = buf.slice(index,index+dlen);
        index += dlen;
        pcount += 1;
        ret[pcount.toString()] = {};
        ret[pcount.toString()].topic = topic; 
        ret[pcount.toString()].topublish = {};
        ret[pcount.toString()].topublish.data = data; 
        ret[pcount.toString()].topublish.receiver  = 'http'; 
        ret[pcount.toString()].topublish.received_time = new Date().toISOString();
        ret[pcount.toString()].topublish.device_id = addr;
        ret[pcount.toString()].topublish.sequence_number = sequence_number;
        if(topic == 'lab11/gps') {
            // GPS
            var day = ret[pcount.toString()].topublish.data.readUInt8(2);
            var month = ret[pcount.toString()].topublish.data.readUInt8(3);
            var year = ret[pcount.toString()].topublish.data.readUInt8(4);
            var hours = ret[pcount.toString()].topublish.data.readUInt8(5);
            var minutes = ret[pcount.toString()].topublish.data.readUInt8(6);
            var seconds = ret[pcount.toString()].topublish.data.readUInt8(7);
            var latitude = ret[pcount.toString()].topublish.data.readInt32BE(8)/(10000*100.0);
            var longitude = ret[pcount.toString()].topublish.data.readInt32BE(12)/(10000*100.0);
            var fix = ['', 'No Fix', '2D', '3D'][ret[pcount.toString()].topublish.data.readUInt8(16)];
            var satellite_count = ret[pcount.toString()].topublish.data.readUInt8(17);

            if (year >= 80) {
              year += 1900;
            } else {
              year += 2000;
            }
            
            hash = Geohash.encode(latitude, longitude, 10);
            ret[pcount.toString()].topublish.geohash = get_hash(addr,hash);
        } else {
            ret[pcount.toString()].topublish.geohash = get_hash(addr);
        }

        if(buf.length <= index) {
            console.log("Done parsing " + pcount + " packets");
            done = true;
        }
    }

    return ret;
}    


var _app = express();
_app.use(expressBodyParser.raw({limit: '10kb'}));

_app.listen(80, function() {
    console.log('Listening for HTTP Requests');
});

var mqtt_client_outgoing = mqtt.connect('mqtt://localhost');
_app.post('/signpost', function(req, res) {
    // Callback for each packet
    buf = req.body;
    console.log(buf.toString('hex'));
    if(buf.length > 6) {
        var pkt = parse(buf);
    }

    //pkt returns an array of things to publish
    for(var key in pkt) {
        console.log("Publishing to topic " + "signpost/" + pkt[key].topic);
        mqtt_client_outgoing.publish('signpost/' + pkt[key].topic, JSON.stringify(pkt[key].topublish));
    }

    res.send("");
});

