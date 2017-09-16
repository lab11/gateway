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

function parse (buf) {
    // Strip out address
    var addr = '';
    for (var i=0; i<6; i++) {
        addr += pad(buf[i].toString(16), 2);
    }
    
    var sequence_number = buf.readUInt8(6);
    
    if(addr == 'c098e5120003') { 
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
            ret[pcount.toString()] = {}; 
            ret[pcount.toString()].topic = topic; 
            ret[pcount.toString()].topublish = {};
            ret[pcount.toString()].topublish.data = data; 
            ret[pcount.toString()].topublish.receiver  = 'lora'; 
            ret[pcount.toString()].topublish.received_time = new Date().toISOString();
            ret[pcount.toString()].topublish.device_id = addr;
            ret[pcount.toString()].topublish.sequence_number = sequence_number;

            if(buf.length <= index) {
                done = true;
            }
        }
    } else {
        var done = false;
        var index = 7;
        var pcount = 0;
        var ret = {};
        while(done == false) {
            var tlen = buf.readUInt8(index);
            index += 1;
            var topic = buf.toString('utf-8',index, index+tlen);
            index += tlen;
            var dlen = buf.readUInt8(index);
            index += 1;
            var data = buf.slice(index,index+dlen);
            index += dlen;
            pcount += 1;
            ret[pcount.toString()] = {}; 
            ret[pcount.toString()].topic = topic; 
            ret[pcount.toString()].topublish = {};
            ret[pcount.toString()].topublish.data = data; 
            ret[pcount.toString()].topublish.receiver  = 'lora'; 
            ret[pcount.toString()].topublish.received_time = new Date().toISOString();
            ret[pcount.toString()].topublish.device_id = addr;
            ret[pcount.toString()].topublish.sequence_number = sequence_number;

            if(buf.length <= index) {
                done = true;
            }
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
                    mqtt_client_outgoing.publish('signpost-preproc/' + pkt[key].topic, JSON.stringify(pkt[key].topublish));
                }
            }
        } catch (e) {
            console.log(e)
        }

    });
});
