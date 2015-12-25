#!/usr/bin/env node

var events = require('events');
var url = require('url');
var util = require('util');

var noble = require('noble');
var request = require('request');
var EddystoneBeaconScanner = require('eddystone-beacon-scanner');
var urlExpander = require('expand-url');
var _ = require('lodash');

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


var FILENAME_PARSE = 'parse.js'
// var FILENAME_META = 'meta.json'


// Store know things about each BLE device
// var beaconid_to_data = {};


var BleGateway = function () {
    this._device_to_data = {};

    noble.on('discover', this.on_discover.bind(this));
    EddystoneBeaconScanner.on('found', this.on_beacon.bind(this));
};

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

// noble.on('discover', function (peripheral) {
BleGateway.prototype.on_discover = function (peripheral) {

    // Don't want the Eddystone beacons at the moment.
    if (!EddystoneBeaconScanner.isBeacon(peripheral)) {

        // We have seen an eddystone packet from the same address
        if (peripheral.id in this._device_to_data) {
            console.log('Recognized device: ' + peripheral.id);

            var device = this._device_to_data[peripheral.id];

            // Unless told not to, we parse advertisements
            if (!argv.noParseAdvertisements) {

                // Check if we have some way to parse the advertisement
                if (device.parser && device.parser.parseAdvertisement) {

                    var parse_advertisement_done = function (adv_obj) {
                        adv_obj.id = peripheral.id;
                        console.log(adv_obj);

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
                    device.parser.parseAdvertisement(peripheral.advertisement, parse_advertisement_done);
                    

                    // // Check if we have a meta file that describes what we should
                    // // do with the data once we get it.
                    // if (device.meta && device.meta.gateway &&
                    //     device.meta.gateway.advertisement &&
                    //     device.meta.gateway.advertisement.actions) {
                    //     var actions = device.meta.gateway.advertisement.actions;
                    //     _.forEach(actions, function (action) {
                    //         if (action.action == 'POST') {
                    //             console.log('POST TO ' + action.url);

                    //             // TODO, make this do something...

                    //         }
                    //     });

                    // }
                }
            }

            // Unless told not to, we see if this device wants us to connect
            if (!argv.noParseServices) {

                var parse_services_done = function (data_obj) {
                    data_obj.id = peripheral.id;
                    console.log(data_obj);

                    // After device-specific code is done, disconnect and handle
                    // returned object.
                    peripheral.disconnect(function (disconnect_error) {
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
                    peripheral.connect(function (connect_error) {
                        if (!connect_error) {
                            // After a successful connection, let the
                            // device specific code read services and whatnot.
                            device.parser.parseServices(peripheral, parse_services_done);
                        }
                    });
                }
            }

        }
    } else {
        console.log('Not interested: ' + peripheral.id);
    }
};

// function require_from_string (src, filename) {
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
// EddystoneBeaconScanner.on('found', function (beacon) {
BleGateway.prototype.on_beacon = function (beacon) {
    if (beacon.type == 'url') {
        console.log('Found eddystone: ' + beacon.id + ' ' + beacon.url);

        // Expand the URL and save it
        urlExpander.expand(beacon.url, function (err, full_url) {
            if (!err) {
                // Create space if this is a new beacon
                if (!(beacon.id in this._device_to_data)) {
                    this._device_to_data[beacon.id] = {};
                }

                // Get only the base (not index.html, for instance)
                var base_url = this.get_base_url(full_url);
                console.log(base_url);

                // Store that
                this._device_to_data[beacon.id]['url'] = base_url;

                // Now see if we can get parse.js
                request(base_url + FILENAME_PARSE, function (req_parse_err, response, body) {
                    if (!req_parse_err && response.statusCode == 200) {
                        console.log('Fetching and loading ' + FILENAME_PARSE + ' for ' + full_url);
                        this._device_to_data[beacon.id]['parse.js'] = body;

                        try {
                            var parser = this.require_from_string(body, base_url + FILENAME_PARSE);
                            this._device_to_data[beacon.id].parser = parser;
                        } catch (e) {}

                    }
                });

                // // And meta.json
                // request(base_url + FILENAME_META, function (meta_parse_err, response, body) {
                //     if (!meta_parse_err && response.statusCode == 200) {
                //         console.log('Fetching and parsing ' + FILENAME_META + ' for ' + full_url);

                //         try {
                //             var meta = JSON.parse(body);
                //             this._device_to_data[beacon.id].meta = meta;
                //         } catch (e) {}
                //     }
                // });
            }
        });

    }
};


// If this is true, we are running this file directly and should
// start the gateway.
if (require.main === module) {
    new BleGateway().start();
}

module.exports = BleGateway;
