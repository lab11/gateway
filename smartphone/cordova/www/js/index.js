
// Functions for converting advertisement to data packet.
var _device_to_data = {};

// Track which URLs we have converted to parsers, so we can tell between
// the first time a packet is seen and if it was cached from a previous run.
var _known_urls = {};

// Keep a map of URL -> parse.js parsers so we don't have to re-download
// parse.js for the same devices.
var _parsers = {};

// ID for this gateway. Required for _meta section of packets.
var _gateway_id = 'unknown';

// Hardcoded constant for the timeout window to check for a new parse.js
var PARSE_JS_CACHE_TIME_IN_MS = 5*60*1000;

// Hardcoded constant for the name of the JavaScript that has the functions
// we care about for this gateway.
var FILENAME_PARSE = 'parse.js';

// Settings for influx
var _influx_settings = {};

var app = {
    // Application Constructor
    initialize: function() {
        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
    },

    // deviceready Event Handler
    //
    // Bind any cordova events here. Common events are:
    // 'pause', 'resume', etc.
    onDeviceReady: function() {

        $('#influx-save').click(function () {
            _influx_settings.host = $('#influx-host').val();
            _influx_settings.database = $('#influx-database').val();
            _influx_settings.port = $('#influx-port').val();
            _influx_settings.protocol = $('#influx-protocol').val();
            _influx_settings.username = $('#influx-username').val();
            _influx_settings.password = $('#influx-password').val();
            _influx_settings.prefix = $('#influx-prefix').val();
            _influx_settings.enable = $('#influx-enable').prop('checked');

            plugins.appPreferences.store(function () {
                console.log('Saved Influx settings successfully.');
            }, function (err) {
                console.log('Failed to save influx settings.');
            }, 'influx-settings', JSON.stringify(_influx_settings));
        });



        // Set the gateway ID when things are running.
        _gateway_id = device.uuid;
        console.log("Gateway ID: " + _gateway_id);

        // Get all influx related settings
        plugins.appPreferences.fetch(function (value) {
            if (value == '') value = '{}';
            _influx_settings = JSON.parse(value);
            console.log('GOT INFLUX SETTINGS');
            console.log(value);
            console.log(_influx_settings);

            // Update UI with saved settings
            if (_influx_settings.enable) $('#influx-enable').prop('checked', true);
            $('#influx-host').val(_influx_settings.host);
            $('#influx-database').val(_influx_settings.database);
            $('#influx-port').val(_influx_settings.port);
            $('#influx-protocol').val(_influx_settings.protocol);
            $('#influx-username').val(_influx_settings.username);
            $('#influx-password').val(_influx_settings.password);
            $('#influx-prefix').val(_influx_settings.prefix);

            start_ble_gateway();
        }, function (err) {
            console.log('Error loading influx settings: ' + err);

            start_ble_gateway();
        }, 'influx-settings');

        function start_ble_gateway () {
            // And get our cache back
            cache_load_from_file(function () {
                // Start scanning for BLE packets
                evothings.ble.reset(function () {
                    console.log('Successfully restarted BLE');
                    evothings.ble.startScan(app.on_discover, app.on_scan_error);
                }, function (err) {
                    console.log('Failed to restart BLE: ' + err);
                });
            });
        }
    },

    // Called for each BLE advertisement
    on_discover: function (evothings_device) {

        // Increment count of total BLE advertisements seen.
        var count = parseInt($('#total-packets').text()) + 1;
        $('#total-packets').text(count);

        // Convert the evothings format to what we consider standard: the
        // Noble advertisement interface.
        var peripheral = app.convert_to_noble(evothings_device);

        // Get the time
        var received_time = new Date().toISOString();

        // We have seen an eddystone packet from the same address
        if (peripheral.address in _device_to_data) {

            // Increment the number of packets where we recognize the address
            // as having a corresponding eddystone packet.
            var count = parseInt($('#understood-packets').text()) + 1;
            $('#understood-packets').text(count);

            // Lookup the correct device to get its parser URL identifier
            var device = _device_to_data[peripheral.address];

            // Check to see if a parser is available
            if (device.request_url in _parsers) {
                var parser_name = _parsers[device.request_url];

                // Check if we have some way to parse the advertisement
                if (app[parser_name] && app[parser_name].parseAdvertisement) {

                    var parse_advertisement_done = function (adv_obj, local_obj) {
                        // only continue if the result was valid
                        if (adv_obj) {

                            // Increment the number of parsed packets.
                            var count = parseInt($('#parsed-packets').text()) + 1;
                            $('#parsed-packets').text(count);

                            adv_obj.id = peripheral.id;

                            // Add a _meta key with some more information
                            adv_obj._meta = {
                                received_time: received_time,
                                device_id:     peripheral.id,
                                receiver:      'smartphone-ble-gateway',
                                gateway_id:    _gateway_id
                            };

                            // Call function with this resule
                            app.parsedAdvertisement(adv_obj);

                            // // Tickle the watchdog now that we have successfully
                            // // handled a pakcet.
                            // watchdog.reset();

                            // // Now check if the device wants to do something
                            // // with the parsed advertisement.
                            // if ((am_submodule || !argv.noPublish) && parser.parser.publishAdvertisement) {
                            //     parser.parser.publishAdvertisement(adv_obj);
                            // }
                        }

                        // Local data is optional
                        if (local_obj) {
                            // Add a _meta key with some more information
                            local_obj._meta = {
                                received_time: received_time,
                                device_id:     peripheral.id,
                                receiver:      'smartphone-ble-gateway',
                                gateway_id:    _gateway_id,
                                base_url:      device.url
                            };

                            // Call function with our resulting data
                            app.parsedLocal(local_obj);
                        }
                    };

                    // Call the device specific advertisement parse function.
                    // Give it the done callback.
                    try {
                        // Increment the number of packets we tried to parse.
                        var count = parseInt($('#attempted-packets').text()) + 1;
                        $('#attempted-packets').text(count);

                        // Add the device ID for parsers to see.
                        peripheral.advertisement.advertiser_id = peripheral.id;
                        app[parser_name].parseAdvertisement(peripheral.advertisement, parse_advertisement_done.bind(this));
                    } catch (e) {
                        console.log('Error calling parse function for ' + peripheral.id + '\n' + e);
                    }
                }
            }
        }

        // Check if the packet we got was actually an eddystone packet
        // and we need to get the `parse.js` file and whatnot.

        var url = app.parse_eddystone_url(peripheral);
        if (url) {
            // See if we still have this device cached and don't need to
            // parse this eddystone packet.
            var device_in_cache = cache_load(peripheral.address, true);

            // Make sure we do this at least once
            if (device_in_cache && (peripheral.address in _device_to_data)) {
                return;
            }

            // Not in cache, so add it and process. Either for the first time
            // or to make sure nothing has changed.
            cache_store(peripheral.address, url);

            // Create space if this is a new beacon
            if (!(peripheral.address in _device_to_data)) {
                _device_to_data[peripheral.address] = {};
            }

            // Check to see if we know how to expand this URL. On the first
            // pass we enforce the timeout. If we can't fetch the correct
            // long URL from the Internet (because maybe the phone doesn't
            // have an Internet connection), then we fallback to a cached
            // copy.
            var short_url = url;
            var long_url = cache_load(short_url, true);

            if (long_url) {
                if (!(long_url in _known_urls)) {
                    // Mark this URL as known, so we don't bother reprocessing
                    // it until it's timed out of the cache.
                    _known_urls[long_url] = true;

                    // Go ahead with handling this URL
                    got_expanded_url.call(this, long_url);

                } else {
                    // If we skip this, we still need to make sure it
                    // happens at least once.
                    if (!('request_url' in _device_to_data[peripheral.address])) {
                        var base_url = app.get_base_url(long_url);
                        var request_url = base_url + FILENAME_PARSE;
                        _device_to_data[peripheral.address]['url'] = base_url;
                        _device_to_data[peripheral.address]['request_url'] = request_url;
                    }
                }

            } else {
                // Expand the URL to get the full URL. Use XMLHttpRequest
                // because it has access to .responseURL.

                var xhr = new XMLHttpRequest();
                xhr.open('GET', short_url, true);
                xhr.onload = function () {
                    got_expanded_url_internet.call(this, null, xhr.responseURL);
                };
                xhr.addEventListener('error', function () {
                    got_expanded_url_internet(true, null);
                });
                xhr.send(null);
            }

            // Called when the URL expander was able to resolve the short
            // URL.
            function got_expanded_url_internet (err, full_url) {
                if (!err) {
                    console.log('Used XMLHttpRequest() to get full url. (' + short_url + ' -> ' + full_url + ')');
                    // Update the cache since we know this is accurate.
                    cache_store(short_url, full_url);

                    // Now do rest of processing
                    got_expanded_url.call(this, full_url);
                } else {
                    console.log('Error getting full URL (' + short_url + ').');
                    console.log('Fallback to cached version if available.');

                    var long_url = cache_load(short_url, false);
                    if (long_url) {
                        got_expanded_url.call(this, long_url);
                    } else {
                        console.log('No cached version of (' + short_url + ') available');
                    }
                }
            }


            // This is called after we have the url expanded and now need to
            // get parser.
            function got_expanded_url (full_url) {
                // Get only the base (not index.html, for instance)
                var base_url = app.get_base_url(full_url);

                // Store that
                _device_to_data[peripheral.address]['url'] = base_url;

                // Figure out the URL we are going to fetch, and store that
                var request_url = base_url + FILENAME_PARSE;
                _device_to_data[peripheral.address]['request_url'] = request_url;

                // See if we have a copy of that parser cached.
                var parse_js_text = cache_load(request_url, true);
                if (parse_js_text) {
                    got_parse_js.call(this, parse_js_text);
                } else {

                    // Don't have this one yet, so lets get it
                    console.log('Fetching ' + request_url + ' (' + peripheral.address + ')');

                    $.ajax(request_url, {
                        success: function (data) {
                            console.log('Got ' + request_url + ' (' + peripheral.address + ')');
                            got_parse_js_internet.call(this, null, data);
                        },
                        error: function () {
                            got_parse_js_internet(true, null);
                        },
                        cache: false,
                    });
                }

                // This is called after we successfully try to fetch parse.js
                function got_parse_js_internet (err, data) {
                    if (!err) {
                        cache_store(request_url, data);
                        got_parse_js.call(this, data);
                    } else {
                        console.log('Could not fetch ' + request_url);
                        console.log('Trying cached copy.');

                        var parse_js_text = cache_load(request_url, false);
                        if (parse_js_text) {
                            got_parse_js.call(this, parse_js_text);
                        } else {
                            console.log('No version in the cache.');
                        }
                    }
                }


                function got_parse_js (parse_js_text) {
                    // Make the downloaded JS an actual function
                    // TODO (2016/01/11): Somehow check if the parser is valid and discard if not.
                    try {
                        var name = request_url.replace(/[^a-z]/gi, '');
                        console.log('Loading parse.js into code: ' + name);
                        app.require_from_string(parse_js_text, name);
                        _parsers[request_url] = name;
                    } catch (e) {
                        console.log('Error parsing JS to instantiate parse.js')
                    }
                };
            };
        }
    },

    on_scan_error: function (error_code) {
        console.log("SCAN ERROR " + error_code);
    },

    parsedAdvertisement: function (adv_obj) {
        if ('device' in adv_obj) {
            var device = adv_obj.device.replace(/^[a-z]/gi, '');
            if ($('#device-' + device).length == 0) {
                $('#packets').append('<div>'+adv_obj.device+': <span id="device-'+device+'">0</span></div>');
            }
            var count = parseInt($('#device-' + device).text());
            count += 1;
            $('#device-' + device).text(count);
        }


        if (_influx_settings.enable == true) {
            app.influx_packet(adv_obj);
        }
    },

    parsedLocal: function (local_obj) {
        console.log(local_obj);
    },


    influx_packet: function (adv_obj) {

    },



    // HELPER FUNCTIONS
    get_base_url: function (full_url) {
        // TODO: Make `url.parse` work!
        var parsed_url = new URL(full_url);
        parsed_url.set('query', '');
        parsed_url.set('hash', '');
        var clean_url = parsed_url.toString();
        if (!clean_url.endsWith('/')) {
            // Now check if there is a index.html or similar at the end
            var url_chunks = clean_url.split('/');
            if (url_chunks[url_chunks.length-1].indexOf('.') != -1) {
                url_chunks.pop();
            }
            clean_url = url_chunks.join('/') + '/';
        }
        return clean_url;
    },

    require_from_string: function (src, name) {
        var before1 = '(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{app.';
        var before2 = ' = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module \'"+o+"\'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){';
        var after = '},{}]},{},[1])(1)});'

        var eval_str = before1 + name + before2 + src + after;

        $("body").append($("<script />", {
          html: eval_str
        }));
    },

    // Takes the evo things BLE format and makes it look like noble
    convert_to_noble: function (peripheral) {
        var out = {};
        out.id = peripheral.address.toLowerCase().replace(/:/g, '');
        out.address = peripheral.address.toLowerCase();
        out.addressType = 'unknown';
        out.connectable = 'unknown';
        out.rssi = peripheral.rssi;
        out.advertisement = {};
        if ('advertisementData' in peripheral) {
            if ('kCBAdvDataLocalName' in peripheral.advertisementData) {
                out.advertisement.localName = peripheral.advertisementData.kCBAdvDataLocalName;
            }
            if ('kCBAdvDataManufacturerData' in peripheral.advertisementData) {
                out.advertisement.manufacturerData = Buffer.from(peripheral.advertisementData.kCBAdvDataManufacturerData, 'base64');
            }
            if ('kCBAdvDataServiceData' in peripheral.advertisementData) {
                out.advertisement.serviceData = [];

                for (var uuid in peripheral.advertisementData.kCBAdvDataServiceData) {
                    out.advertisement.serviceData.push({
                        uuid: uuid,
                        data: Buffer.from(peripheral.advertisementData.kCBAdvDataServiceData[uuid], 'base64')
                    });
                }
            }
        }

        return out;
    },

    // Takes noble encoded advertisement and returns the eddystone URL if
    // there is one. Otherwise returns null.
    parse_eddystone_url: function (peripheral) {
        if (!('serviceData' in peripheral.advertisement)) return null;
        var buf = null;
        for (var i=0; i<peripheral.advertisement.serviceData.length; i++) {
            if (peripheral.advertisement.serviceData[i].uuid == '0000feaa-0000-1000-8000-00805f9b34fb') {
                buf = peripheral.advertisement.serviceData[i].data;
            }
        }
        if (!buf) return null;

        // Check for URL frame
        if (buf.readUInt8(0) != 0x10) return null;
        if (buf.length < 4) return null;

        // Get http:// prefix
        var prefix_index = buf.readUInt8(2);
        if (prefix_index >= 4) return null;
        var url = ['http://www.', 'https://www.', 'http://', 'https://'][prefix_index];

        for (var i=3; i<buf.length; i++) {
            var c = buf.readUInt8(i);

            if (c < 14) {
                // TLD shortcut
                url += ['.com/', '.org/', '.edu/', '.net/', '.info/', '.biz/', '.gov/',
                        '.com', '.org', '.edu', '.net', '.info', '.biz', '.gov'][c];
            } else if (c < 32 || c > 127) {
                // Error
                return null;
            } else {
                url += String.fromCharCode(c);
            }
        }
        return url;
    }
};

app.initialize();
