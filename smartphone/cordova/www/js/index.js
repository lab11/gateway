
// Functions for converting advertisement to data packet.
var _device_to_data = {};

// Keep a map of URL -> parse.js parsers so we don't have to re-download
// parse.js for the same devices.
var _parsers = {};

// // Keep track of shortened URLs to the full expanded URL so we don't
// // have to query each time we get a short URL
// var _cached_urls = {};

// // Keep track of when we last fetched parse.js for a node so that we get
// // a possible new copy periodically.
// var _device_id_ages = {};

var _gateway_id = 'unknown';

// Hardcoded constant for the timeout window to check for a new parse.js
var PARSE_JS_CACHE_TIME_IN_MS = 5*60*1000;

// Hardcoded constant for the name of the JavaScript that has the functions
// we care about for this gateway.
var FILENAME_PARSE = 'parse.js'

// var _BUFFER = undefined;

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

        // _BUFFER = __Buffer;

        // var bllll = require('./BLEES');
        // console.log(BLEES)
        // console.log(BLEES.parseAdvertisement)

        // Set the gateway ID when things are running.
        _gateway_id = device.uuid;
        console.log("Gateway ID: " + _gateway_id)

        // And get our cache back
        cache_load_from_file();

        // Start scanning for BLE packets
        evothings.ble.stopScan();
        evothings.ble.startScan(app.on_discover, app.on_scan_error);





    },

    on_discover: function (evothings_device) {
        // console.log("\n\nGot packet");
        // console.log(JSON.stringify(evothings_device));

        // var k = evothings.ble.parseAdvertisementData(peripheral);

        // console.log(k);
        // console.log(JSON.stringify(k));

        var peripheral = app.convert_to_noble(evothings_device);
        // console.log(peripheral);
        // console.log(JSON.stringify(peripheral));




        // Get the time
        var received_time = new Date().toISOString();

        // We have seen an eddystone packet from the same address
        if (peripheral.address in _device_to_data) {

            // Lookup the correct device to get its parser URL identifier
            var device = _device_to_data[peripheral.address];

            // Check to see if a parser is available
            if (device.request_url in _parsers) {
                var parser_name = _parsers[device.request_url];

console.log(' USING PARSER ' + parser_name + ' for ' + peripheral.address);
if (app[parser_name]) {
    console.log('first passes')
}
if (app[parser_name].parseAdvertisement) {
    console.log('second pases')
}

                // Check if we have some way to parse the advertisement
                if (app[parser_name] && app[parser_name].parseAdvertisement) {

                    var parse_advertisement_done = function (adv_obj, local_obj) {

                        // only continue if the result was valid
                        if (adv_obj) {
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


console.log(' CALL THE PARSER ' + parser_name);
                    // Call the device specific advertisement parse function.
                    // Give it the done callback.
                    try {
                        // add the device ID for parsers to see
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
        // if (url && url == 'http://j2x.us/sbMMHT') {
            // This is an Eddystone URL packet
            // console.log('Found eddystone: ' + peripheral.address + ' ' + url);

            // See if we still have this device cached and don't need to
            // parse this eddystone packet
            var device_in_cache = cache_load(peripheral.address, true);
// console.log("cahce: " + device_in_cache)
            if (device_in_cache) return;
// console.log('This eddystone not in cache or old in cache')

            // Not in cache, so add it and process. Either for the first time
            // or to make sure nothing has changed.
            cache_store(peripheral.address, true);

            // // We keep a list of the last time we looked in to each device.
            // // We only check on a device periodically to not overwhelm any
            // // processing.
            // if (beacon.id in _device_id_ages) {
            //     if ((now - _device_id_ages[beacon.id]) < PARSE_JS_CACHE_TIME_IN_MS) {
            //         return;
            //     }
            // }
            // _device_id_ages[beacon.id] = now;

            // // Now take short URL and get the expanded URL.



            // Check to see if we know how to expand this URL. On the first
            // pass we enforce the timeout. If we can't fetch the correct
            // long URL from the Internet (because maybe the phone doesn't
            // have an Internet connection), then we fallback to a cached
            // copy.
            var short_url = url;
            var long_url = cache_load(short_url, true);

            if (!long_url) {
                // TODO: NEED ACTUAL URL EXPANDER
// console.log('EXPAND IT ('  + short_url + ') YEAH YEAH ');
                // urlExpander.expand(short_url, got_expanded_url_internet.bind(this));

        // $.ajax(short_url, {
        //     success: function (data, status, xhr) {
        //         console.log('first')
        //         console.log(status);
        //         console.log(xhr);
        //         console.log(xhr.getResponseHeader('Location'));
        //         console.log(xhr.getAllResponseHeaders());
        //         console.log(xhr.responseURL);
        //     }
        // });

                var xhr = new XMLHttpRequest();
                xhr.open('GET', short_url, true);
                xhr.onload = xml_expanded_url_cb.bind(this);
                xhr.send(null);

                function xml_expanded_url_cb () {
                    // TODO: WHAT TO PUT AS THE ERROR?!?
                    got_expanded_url_internet.call(this, null, xhr.responseURL)
                }


            } else {
// console.log('HAD CACHED LONG URL');
                // Go ahead with handling this URL
                got_expanded_url.call(this, long_url);
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

                // Create space if this is a new beacon
                if (!(peripheral.address in _device_to_data)) {
                    _device_to_data[peripheral.address] = {};
                }

                // Get only the base (not index.html, for instance)
                var base_url = app.get_base_url(full_url);

                // Store that
                _device_to_data[peripheral.address]['url'] = base_url;

                // Figure out the URL we are going to fetch, and store that
                var request_url = base_url + FILENAME_PARSE;
                _device_to_data[peripheral.address]['request_url'] = request_url;

                // See if we have a copy of that parser cached
                var parse_js_text = cache_load(request_url, true);
                if (parse_js_text) {
                    got_parse_js.call(this, parse_js_text);
                } else {

                    // Don't have this one yet, so lets get it
                    console.log('Fetching ' + request_url + ' (' + peripheral.address + ')');

                    $.get(request_url, parse_js_jquery_get_cb.bind(this));

                    function parse_js_jquery_get_cb (data) {
                        // TODO HOW TO SET ERROR?
                        got_parse_js_internet.call(this, null, data);

                    }

                    // TODO: MAKE THIS FETCH ACTUALLY WORK

                //     // Now see if we can get parse.js
                //     // async.retry({tries: 10, interval: 400}, function (cb, r) {
                //         request(request_url, function (err, response, body) {
                //             // We want to error if err or 503
                //             var request_err = (err || response.statusCode==503);
                //             cb(request_err, response);
                //         });
                //     // }, got_parse_js.bind(this));
                // } else {
                //     debug('Using cached parse.js for ' + beacon.id);
                // }
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
                    console.log('Loading ' + FILENAME_PARSE + ' for ' + full_url + ' (' + peripheral.address + ')');
                    // console.log(parse_js_text);



                    // Make the downloaded JS an actual function
                    // TODO (2016/01/11): Somehow check if the parser is valid and discard if not.
                    try {
                        var name = request_url.replace(/[^a-z]/gi, '');
                        app.require_from_string(parse_js_text, name);
                        _parsers[request_url] = name;

                        // console.log('DID IT TAKE??')
                        // console.log(app['TESTEROK']);
                        // console.log(app['TESTEROK'].parseAdvertisement);
                        // console.log('NO?')

                    } catch (e) {
                        console.log('hit this????????')
                    }

                };




            };

            // If we are processing a device's eddystone packet, always
            // expand the URL. We could



        }






    },

    on_scan_error: function (error_code) {
        console.log("SCAN ERROR " + error_code);
    },

    parsedAdvertisement: function (adv_obj) {
        console.log(adv_obj);
        console.log(JSON.stringify(adv_obj));
    },

    parsedLocal: function (local_obj) {
        console.log(local_obj);
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
        // var before = '(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module \'"+o+"\'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){';
        // var after = '},{}]},{},[1]);'
        var before1 = '(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{app.';
        var before2 = ' = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module \'"+o+"\'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){';
        var after = '},{}]},{},[1])(1)});'

        var eval_str = before1 + name + before2 + src + after;
        // console.log(eval_str);
        // var k = eval(eval_str);
        // console.log(k);

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