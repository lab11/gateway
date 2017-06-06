#!/usr/bin/env node

// Reboot gateway if it looses internet connection for a while.

var child_process = require('child_process');
var dns           = require('dns');

var watchout = require('watchout');

// Set a watchdog which will restart the gateway if it can't resolve a DNS
// address.
var watchdog = new watchout(10*60*1000, function(didCancelWatchdog) {
    if (!didCancelWatchdog) {
        child_process.exec('sudo shutdown -r now', function (err, stderr, stdout) {
            console.log('Called reboot because no internet.');
        });
    }
});

function check_internet () {
    dns.lookup('google.com', function (err) {
        if (!err) {
            watchdog.reset();
        }
    });
}

// Check internet every minute.
check_internet();
setInterval(check_internet, 1*60*1000);
