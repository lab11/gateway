#!/usr/bin/env node

var url = require('url');

var noble = require('noble');
var request = require('request');
var EddystoneBeaconScanner = require('eddystone-beacon-scanner');
var urlExpander = require('expand-url');
var _ = require('lodash');


var FILENAME_PARSE = 'parse.js'
var FILENAME_META = 'meta.json'


// Store know things about each BLE device
var beaconid_to_data = {};



function start () {
  var startScanningOnPowerOn = function() {
    if (noble.state === 'poweredOn') {
      noble.startScanning([], true);
    } else {
      noble.once('stateChange', startScanningOnPowerOn);
    }
  };

  startScanningOnPowerOn();
};

noble.on('discover', function (peripheral) {

    // Don't want the Eddystone beacons at the moment.
    if (!EddystoneBeaconScanner.isBeacon(peripheral)) {

        // We have seen an eddystone packet from the same address
        if (peripheral.id in beaconid_to_data) {
            console.log('Recognized device: ' + peripheral.id);

            var device = beaconid_to_data[peripheral.id];

            // Check if we have some way to parse the advertisement
            if (device.parser && device.parser.parse_advertisement) {
                var out = device.parser.parse_advertisement(peripheral.advertisement);
                out.id = peripheral.id;
                console.log(out);

                // Check if we have a meta file that describes what we should
                // do with the data once we get it.
                if (device.meta && device.meta.gateway &&
                    device.meta.gateway.advertisement &&
                    device.meta.gateway.advertisement.actions) {
                    var actions = device.meta.gateway.advertisement.actions;
                    _.forEach(actions, function (action) {
                        if (action.action == 'POST') {
                            console.log('POST TO ' + action.url);

                            // TODO, make this do something...

                        }
                    });

                }
            }

        }
    }
});

function require_from_string (src, filename) {
    var m = new module.constructor();
    m.paths = module.paths;
    m._compile(src, filename);
    return m.exports;
}

// We want just the base URL.
// So, something like "https://a.com/folder/page.html?q=1#here"
// should turn in to "https://a.com/folder/"
function get_base_url (full_url) {
    var parsed_url = url.parse(full_url);
    parsed_url.query = '';
    parsed_url.hash = '';
    var clean_url = url.format(parsed_url);
    if (!clean_url.endsWith('/')) {
        // Now check if there is a index.html or similar at the end
        var url_chunks = clean_url.split('/');
        if (url_chunks[url_chunks.length-1].indexOf('.') != -1) {
            url_chunks.pop();
        }
        clean_url = url_chunks.join('/') + '/';
    }
    return clean_url;
}

// Callback when an eddystone beacon is found.
EddystoneBeaconScanner.on('found', function (beacon) {
    if (beacon.type == 'url') {
        console.log('Found eddystone: ' + beacon.id + ' ' + beacon.url);

        // Expand the URL and save it
        urlExpander.expand(beacon.url, function (err, full_url) {
            if (!err) {
                // Create space if this is a new beacon
                if (!(beacon.id in beaconid_to_data)) {
                    beaconid_to_data[beacon.id] = {};
                }

                // Get only the base (not index.html, for instance)
                var base_url = get_base_url(full_url);
                console.log(base_url);

                // Store that
                beaconid_to_data[beacon.id]['url'] = base_url;

                // Now see if we can get parse.js
                request(base_url + FILENAME_PARSE, function (req_parse_err, response, body) {
                    if (!req_parse_err && response.statusCode == 200) {
                        console.log('Fetching and loading ' + FILENAME_PARSE + ' for ' + full_url);
                        beaconid_to_data[beacon.id]['parse.js'] = body;

                        try {
                            var parser = require_from_string(body, base_url + FILENAME_PARSE);
                            beaconid_to_data[beacon.id].parser = parser;
                        } catch (e) {}

                    }
                });

                // And meta.json
                request(base_url + FILENAME_META, function (meta_parse_err, response, body) {
                    if (!meta_parse_err && response.statusCode == 200) {
                        console.log('Fetching and parsing ' + FILENAME_META + ' for ' + full_url);

                        try {
                            var meta = JSON.parse(body);
                            beaconid_to_data[beacon.id].meta = meta;
                        } catch (e) {}
                    }
                });
            }
        });

    }
});

start();
