
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

        // Set the gateway ID when things are running.
        _gateway_id = device.uuid;

        // And get our cache back
        cache_load_from_file();

        // Start scanning for BLE packets
        evothings.ble.startScan(app.on_discover, app.on_scan_error);





    },

    on_discover: function (peripheral) {
        console.log("Got packet");
        console.log(device);


        // Get the time
        var received_time = new Date().toISOString();

        // We have seen an eddystone packet from the same address
        if (peripheral.id in _device_to_data) {

            // Lookup the correct device to get its parser URL identifier
            var device = _device_to_data[peripheral.id];

            // Check to see if a parser is available
            if (device.request_url in _parsers) {
                var parser = _cached_parsers[device.request_url];

                // Check if we have some way to parse the advertisement
                if (parser && parser.parseAdvertisement) {

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
                            this.parsedAdvertisement(adv_obj);

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
                            this.parsedLocal(local_obj);
                        }
                    };

                    // Call the device specific advertisement parse function.
                    // Give it the done callback.
                    try {
                        // add the device ID for parsers to see
                        peripheral.advertisement.advertiser_id = peripheral.id;
                        parser.parseAdvertisement(peripheral.advertisement, parse_advertisement_done.bind(this));
                    } catch (e) {
                        console.log('Error calling parse function for ' + peripheral.id + '\n' + e);
                    }
                }
            }
        }

        // Check if the packet we got was actually an eddystone packet
        // and we need to get the `parse.js` file and whatnot.

        // TODO: MAKE THIS CHECK ACTUALLY WORK
        if (peripheral.is_eddystone) {


            // TODO: CONVERT PERIPHERAL TO BEACON OBJECT

            debug('Found eddystone: ' + beacon.id + ' ' + beacon.url);

            // See if we still have this device cached and don't need to
            // parse this eddystone packet
            var device_in_cache = cache_load(beacon.id, true);
            if (device_in_cache) return;

            // Not in cache, so add it and process. Either for the first time
            // or to make sure nothing has changed.
            cache_store(beacon.id, true);

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
            var short_url = beacon.url;
            var long_url = cache_load(short_url, true);

            if (!long_url) {
                // TODO: NEED ACTUAL URL EXPANDER
                urlExpander.expand(short_url, got_expanded_url_internet.bind(this));
            } else {
                // Go ahead with handling this URL
                got_expanded_url.call(this, long_url);
            }

            // Called when the URL expander was able to resolve the short
            // URL.
            function got_expanded_url_internet (err, full_url) {
                if (!err) {
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
                if (!(beacon.id in _device_to_data)) {
                    _device_to_data[beacon.id] = {};
                }

                // Get only the base (not index.html, for instance)
                var base_url = this.get_base_url(full_url);

                // Store that
                _device_to_data[beacon.id]['url'] = base_url;

                // Figure out the URL we are going to fetch, and store that
                var request_url = base_url + FILENAME_PARSE;
                _device_to_data[beacon.id]['request_url'] = request_url;

                // See if we have a copy of that parser cached
                var parse_js_text = cache_load(request_url, true);
                if (parse_js_text) {
                    got_parse_js.call(this, parse_js_text);
                } else {

                // }

                // // Check if we already know about this URL
                // if (!(request_url in _cached_parsers)) {

                    // Don't have this one yet, so lets get it
                    console.log('Fetching ' + request_url + ' (' + beacon.id + ')');

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
                function got_parse_js_internet (err, response) {
                    if (!err && response.statusCode == 200) {
                        cache_store(request_url, t);
                        got_parse_js.call(this, t);
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
                    console.log('Loading ' + FILENAME_PARSE + ' for ' + full_url + ' (' + beacon.id + ')');



                    // Make the downloaded JS an actual function
                    // TODO (2016/01/11): Somehow check if the parser is valid and discard if not.
                    try {
                        var parser = this.require_from_string(parse_js_text, request_url);
                        this._parsers[request_url] = parser;
                    } catch (e) {}

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
    },

    parsedLocal: function (local_obj) {
        console.log(local_obj);
    },

    // HELPER FUNCTIONS
    get_base_url: function (full_url) {
        // TODO: Make `url.parse` work!
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
};

app.initialize();