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

try {
    var config_file = fs.readFileSync('/etc/swarm-gateway/lora.conf', 'utf-8');
    var config = ini.parse(config_file);
    if (config.host == undefined || config.host == '') {
        throw new Exception('no settings');
    }
} catch (e) {console.log(e)
    console.log('Could not find /etc/swarm-gateway/lora.conf or lora not configured.');
    process.exit(1);
}

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
        var tlen = buf.readUInt8(index);
        index += 1;
        var topic = buf.toString('utf-8',index, index+tlen);
        index += tlen;
        var dlen = buf.readUInt16BE(index);
        index += 2;
        var data = buf.slice(index,index+dlen);
        index += dlen;
        pcount += 1;
        ret[pcount.toString()].topic = topic; 
        ret[pcount.toString()].topublish = {};
        ret[pcount.toString()].topublish.data = data; 
        ret[pcount.toString()].topublish.receiver  = 'lora'; 
        ret[pcount.toString()].topublish.received_time = new Date().toISOString();
        ret[pcount.toString()].topublish.device_id = addr;
        if(topic == 'signpost/lab11/gps') {
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
            done = true;
        }
    }

    return ret;
}    

var mqtt_client_lora = mqtt.connect(config.protocol + '://' + config.host + ':' + config.port, {username: config.username, password: config.password});
var mqtt_client_outgoing = mqtt.connect('mqtt://localhost');
mqtt_client_lora.on('connect', function () {
    // Subscribe to all packets
    mqtt_client_lora.subscribe('application/5/node/#');

    // Callback for each packet
    mqtt_client_lora.on('message', function (topic, message) {
        var json = JSON.parse(message.toString());
        try {
            if(json.data) {
                buf = Buffer.from(json.data, 'base64');
                console.log(buf.toString('hex'));
                if(buf.length > 6) {
                    var pkt = parse(buf);
                }

                //pkt returns an array of things to publish
                for(var key in pkt) {
                    mqtt_client_outgoing.publish(pkt[key].topic, JSON.stringify(pkt[key].topublish));
                }
            }
        } catch (e) {
            console.log(e)
        }

    });
});
