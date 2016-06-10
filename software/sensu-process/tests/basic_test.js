#! /usr/bin/env node

var SensuProcess = require('../sensu-process');

// Initialize and send keepalives
SensuProcess.init('./sensu.conf', 'SensuTest');
SensuProcess.begin();

setInterval(send_keepalive, 75*1000);

function send_keepalive () {
    console.log("Sending keepalive");
    SensuProcess.keepalive();
}

