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
var express       = require('express');
var expressBodyParser       = require('body-parser');

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

        //console.log("Topic length is: " + tlen);
        index += 1;
        var topic = buf.toString('utf-8',index, index+tlen);
        index += tlen;
        var dlen = buf.readUInt16BE(index);
        if(tlen + dlen + 3 > total_len) {
            console.log("Length parsing error - continueing");
            index = start_index + total_len;
            continue;
        }

        //console.log("Data length is: " + dlen);
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

        if(buf.length <= index) {
            //console.log("Done parsing " + pcount + " packets");
            done = true;
        }
    }

    return ret;
}    


var _app = express();
_app.use(expressBodyParser.raw({limit: '1000kb'}));

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
        //console.log("Publishing to topic " + "signpost/" + pkt[key].topic);
        mqtt_client_outgoing.publish('signpost-preproc/' + pkt[key].topic, JSON.stringify(pkt[key].topublish));
    }

    res.send("");
});

