#!/usr/bin/env node

var events = require('events');
var url = require('url');
var util = require('util');

var noble = require('noble');
var request = require('request');
var EddystoneBeaconScanner = require('eddystone-beacon-scanner');
var urlExpander = require('expand-url');
var _ = require('lodash');
var debug = require('debug')('ble-gateway');

var argv = require('yargs')
    .help('h')
    .alias('h', 'help')
    .option('no-parse-advertisements', {
        describe: 'this gateway should not parse advertisements',
        boolean: true,
    })
    .option('no-parse-services', {
        describe: 'this gateway should not connect and parse services',
        boolean: true
    })
    .option('no-publish', {
        describe: 'this gateway should not publish parsed data',
        boolean: true
    })
    .argv;


// Hardcoded constant for the name of the JavaScript that has the functions
// we care about for this gateway.
var FILENAME_PARSE = 'parse.js'

// Main object for the BleGateway
var BleGateway = function () {
    debug('Creating a new gateway');
    this._device_to_data = {};

    noble.on('discover', this.on_discover.bind(this));
    EddystoneBeaconScanner.on('found', this.on_beacon.bind(this));
};

// We use the EventEmitter pattern to return parsed objects
util.inherits(BleGateway, events.EventEmitter);

// Call .start() to run the gateway functionality
BleGateway.prototype.start = function () {
  var startScanningOnPowerOn = function() {
    if (noble.state === 'poweredOn') {
      noble.startScanning([], true);
    } else {
      noble.once('stateChange', startScanningOnPowerOn);
    }
  };

  startScanningOnPowerOn();
};

// Called on each advertisement packet
BleGateway.prototype.on_discover = function (peripheral) {

    // Don't want the Eddystone beacons at the moment.
    if (!EddystoneBeaconScanner.isBeacon(peripheral)) {

        // We have seen an eddystone packet from the same address
        if (peripheral.id in this._device_to_data) {

            var device = this._device_to_data[peripheral.id];

            // Unless told not to, we parse advertisements
            if (!argv.noParseAdvertisements) {

                // Check if we have some way to parse the advertisement
                if (device.parser && device.parser.parseAdvertisement) {

                    var parse_advertisement_done = function (adv_obj) {
                        adv_obj.id = peripheral.id;

                        // We broadcast on "advertisement"
                        this.emit('advertisement', adv_obj);

                        // Now check if the device wants to do something
                        // with the parsed advertisement.
                        if (!argv.noPublish && device.parser.publishAdvertisement) {
                            device.parser.publishAdvertisement(adv_obj);
                        }
                    };

                    // Call the device specific advertisement parse function.
                    // Give it the done callback.
                    device.parser.parseAdvertisement(peripheral.advertisement, parse_advertisement_done.bind(this));
                }
            }

            // Unless told not to, we see if this device wants us to connect
            if (!argv.noParseServices) {

                var parse_services_done = function (data_obj) {
                    data_obj.id = peripheral.id;

                    // After device-specific code is done, disconnect and handle
                    // returned object.
                    peripheral.disconnect((disconnect_error) => {
                        if (!disconnect_error) {
                            // Broadcast this on "data"
                            this.emit('data', data_obj);

                            // Now check if the device wants to do something
                            // with the parsed service data.
                            if (!argv.noPublish && device.parser.publishServiceData) {
                                device.parser.publishServiceData(data_obj);
                            }
                        }
                    });
                }

                // Check if we have some code to connect
                if (device.parser && device.parser.parseServices) {
                    // Use noble to connect to the BLE device
                    peripheral.connect((connect_error) => {
                        if (!connect_error) {
                            // After a successful connection, let the
                            // device specific code read services and whatnot.
                            device.parser.parseServices(peripheral, parse_services_done.bind(this));
                        }
                    });
                }
            }

        }
    } else {
        // We don't parse eddystone packets for content
        debug('Skipping Eddystone packet for: ' + peripheral.id);
    }
};

// Load the downloaded code into a useable module
BleGateway.prototype.require_from_string = function (src, filename) {
    var m = new module.constructor();
    m.paths = module.paths;
    m._compile(src, filename);
    return m.exports;
}

// We want just the base URL.
// So, something like "https://a.com/folder/page.html?q=1#here"
// should turn in to "https://a.com/folder/"
// function get_base_url (full_url) {
BleGateway.prototype.get_base_url = function (full_url) {
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
BleGateway.prototype.on_beacon = function (beacon) {

    if (beacon.type == 'url') {
        debug('Found eddystone: ' + beacon.id + ' ' + beacon.url);

        // Expand the URL and save it
        urlExpander.expand(beacon.url, (err, full_url) => {
            if (!err) {
                // Create space if this is a new beacon
                if (!(beacon.id in this._device_to_data)) {
                    this._device_to_data[beacon.id] = {};
                }

                // Get only the base (not index.html, for instance)
                var base_url = this.get_base_url(full_url);

                // Store that
                this._device_to_data[beacon.id]['url'] = base_url;

                // Now see if we can get parse.js
                request(base_url + FILENAME_PARSE, (req_parse_err, response, body) => {
                    if (!req_parse_err && response.statusCode == 200) {
                        debug('Fetching and loading ' + FILENAME_PARSE + ' for ' + full_url);
                        this._device_to_data[beacon.id]['parse.js'] = body;

                        try {
                            var parser = this.require_from_string(body, base_url + FILENAME_PARSE);
                            this._device_to_data[beacon.id].parser = parser;
                            parser.parseAdvertisement();
                        } catch (e) {}

                    }
                });
            }
        });

    }
};


// If this is true, we are running this file directly and should
// start the gateway.
if (require.main === module) {
    var bleg = new BleGateway();

    bleg.on('advertisement', function (adv_obj) {
        console.log(adv_obj);
    });

    bleg.start();
}

module.exports = new BleGateway();
