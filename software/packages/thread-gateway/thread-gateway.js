#!/usr/bin/env node

var events = require('events');
var url    = require('url');
var util   = require('util');

var coap                   = require('coap');
var server                 = coap.createServer();
var request                = require('request');
var urlExpander            = require('expand-url');
var _                      = require('lodash');
var debug                  = require('debug')('thread-gateway');
var watchout               = require('watchout');
var async                  = require('async');
var gatewayId              = require('lab11-gateway-id');
var fs                     = require('fs');

// There is a currently unknown issue where this script will hang sometimes,
// for the moment, we work around it with the venerage watchdog timer
var watchdog = new watchout(30*60*1000, function(didCancelWatchdog) {
    if (didCancelWatchdog) {
        // benign
    } else {
        debug("Watchdog tripped");
        process.exit(1);
    }
});


// Whether or not this is running inside of another app as a module.
// We expect this to normally be true.
var am_submodule = (require.main !== module);

// Hardcoded constant for the name of the JavaScript that has the functions
// we care about for this gateway.
var FILENAME_PARSE = 'parse_thread.js'

// Hardcoded constant for the timeout window to check for a new parse.js
var PARSE_JS_CACHE_TIME_IN_MS = 5*60*1000;

// Main object for the ThreadGateway
var ThreadGateway = function () {
    debug('Creating a new thread gateway');
    this._device_to_data = {};

    // Keep a map of URL -> parse.js parsers so we don't have to re-download
    // parse.js for the same devices.
    this._cached_parsers = {};

    // Keep track of shortened URLs to the full expanded URL so we don't
    // have to query each time we get a short URL
    this._cached_urls = {};

    server.on('request', this.on_request.bind(this));
    this._device_id_ages = {};
};

// We use the EventEmitter pattern to return parsed objects
util.inherits(ThreadGateway, events.EventEmitter);

// Call .start() to run the gateway functionality
ThreadGateway.prototype.start = function () {
    // Get the gateway ID for the running gateway to include in the data packets.
    this._gateway_id = '';
    gatewayId.id((id) => {
        this._gateway_id = id;
    });
  server.listen(function() {
    debug("Listening");
  });
};

// Called on each request
ThreadGateway.prototype.on_request = function (req, res) {
  try {

    // Get device id
    var id_len = req.payload.readUInt8(0);
    var device_id = req.payload.slice(1, 1+id_len).toString('hex');
    debug(req.code + " request from " + device_id + " for resource " + req.url);
    var payload = req.payload.slice(1+id_len);

    debug(req.url);
    if (req.url === "/discovery") {
      var url_len = payload.readUInt8(0);
      var parser_url = 'https://' + payload.toString('utf8', 1, url_len+1);
      this.get_parser(device_id, parser_url);
      return;
    }

    // Get the time
    var received_time = new Date().toISOString();

    // We have seen an discovery packet from the same address
    if (device_id in this._device_to_data) {

      // Lookup the correct device to get its parser URL identifier
      var device = this._device_to_data[device_id];

      // Check to see if a parser is available
      if (device.request_url in this._cached_parsers) {
        var parser = this._cached_parsers[device.request_url];

        // Unless told not to, we parse payloads
        if (am_submodule || !argv.noParsePayloads) {

          // Check if we have some way to parse the payload
          if (parser.parser && parser.parser.parsePayload) {

            var parse_payload_done = function (adv_obj, local_obj) {

              // only continue if the result was valid
              if (adv_obj) {
                adv_obj.id = device_id;

                // Add a _meta key with some more information
                adv_obj._meta = {
                  received_time: received_time,
                  device_id:     device_id,
                  receiver:      'ble-gateway',
                  gateway_id:    this._gateway_id
                };

                // We broadcast on "payload"
                this.emit('payload', adv_obj);

                // Tickle the watchdog now that we have successfully
                // handled a pakcet.
                watchdog.reset();

                // Now check if the device wants to do something
                // with the parsed payload.
                if ((am_submodule || !argv.noPublish) && parser.parser.publishPayload) {
                  parser.parser.publishPayload(adv_obj);
                }
              }

              // Local data is optional
              if (local_obj) {
                // Add a _meta key with some more information
                local_obj._meta = {
                  received_time: received_time,
                  device_id:     device_id,
                  receiver:      'thread-gateway',
                  gateway_id:    this._gateway_id,
                  base_url:      device.url
                };

                // We broadcast on "local"
                this.emit('local', local_obj);
              }
            };

            // Call the device specific payload parse function.
            // Give it the done callback.
            try {
              // add the device ID for parsers to see
              parser.parser.parsePayload(device_id, req.url, payload, parse_payload_done.bind(this));
            } catch (e) {
              debug('Error calling parse function for ' + device_id + '\n' + e);
            }
          }
        }
      }
    }
  } catch(e) {
    debug(e);
  }
};

// Load the downloaded code into a useable module
ThreadGateway.prototype.require_from_string = function (src, filename) {
    var m = new module.constructor();
    m.paths = module.paths;
    m._compile(src, filename);
    return m.exports;
}

// We want just the base URL.
// So, something like "https://a.com/folder/page.html?q=1#here"
// should turn in to "https://a.com/folder/"
// function get_base_url (full_url) {
ThreadGateway.prototype.get_base_url = function (full_url) {
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

// function to acquire parser from discovery message
ThreadGateway.prototype.get_parser = function (device_id, parser_url) {
  // Tickle the watchdog
  watchdog.reset();

  // We keep a list of the last time we updated for each device, this allows
  // the gateway to pull down new parse.js files when they update
  if (device_id in this._device_id_ages) {
    if ((Date.now() - this._device_id_ages[device_id]) < PARSE_JS_CACHE_TIME_IN_MS) {
      return;
    }
  }

  debug('Discovered device: ' + device_id + ' ' + parser_url);

  var short_url = parser_url;
  var url_path = url.parse(parser_url).pathname;

  // This is called when we successfully get the expanded URL.
  var got_expanded_url = function (err, full_url) {
    if (!err) {
      // Save this URL expansion. OK to just overwrite it each time.
      this._cached_urls[short_url] = full_url;
      fs.writeFileSync('cached_urls.json', JSON.stringify(this._cached_urls));

      // Create space if this is an unseen device
      if (!(device_id in this._device_to_data)) {
        this._device_to_data[device_id] = {};
      }

      // Get only the base (not index.html, for instance)
      var base_url = this.get_base_url(full_url);

      // Store that
      this._device_to_data[device_id]['url'] = base_url;

      // Figure out the URL we are going to fetch, and store that
      var request_url = base_url + FILENAME_PARSE;
      this._device_to_data[device_id]['request_url'] = request_url;

      // This is called after we successfully try to fetch parse.js
      var got_parse_js = function (err, response) {
        if (!err && response.statusCode == 200) {
          debug('Loading ' + FILENAME_PARSE + ' for ' + full_url + ' (' + device_id + ')');

          // Store this in the known parsers object
          this._cached_parsers[request_url] = {};
          this._cached_parsers[request_url]['parse.js'] = response.body;
          fs.writeFileSync('cached_parsers.json', JSON.stringify(this._cached_parsers));

          // Make the downloaded JS an actual function
          // TODO (2016/01/11): Somehow check if the parser is valid and discard if not.
          try {
            var parser = this.require_from_string(response.body, request_url);
            this._cached_parsers[request_url].parser = parser;

            //update the cache to indicate we actually have this parser
            this._device_id_ages[device_id] = Date.now();
            parser.parsePayload();
          } catch (e) {
            console.log(e);
            debug('Failed to parse payload after fetching parser');
          }

        } else {
          debug('Could not fetch parse.js after trying multiple times. (' + device_id + ')');
          try {
            debug('Trying to find cached parser. (' + device_id + ')');
            cacheString = fs.readFileSync('cached_parsers.json', 'utf-8');
            this._cached_parsers = JSON.parse(cacheString);
            for (var r_url in this._cached_parsers) {
              var parser = this.require_from_string(this._cached_parsers[r_url]['parse.js'], r_url);
              this._cached_parsers[r_url].parser = parser;
            }

            //update the cache to indicate we actually have this parser
            this._device_id_ages[device_id] = Date.now();
          } catch (e) {
            debug('Failed to find cached parsers. (' + device_id + ')');
          }
        }
      };

      // Check if we already know about this URL
      if (!(request_url in this._cached_parsers)) {
        // Don't have this one yet, so lets get it
        debug('Fetching ' + request_url + ' (' + device_id + ')');

        // Now see if we can get parse.js
        async.retry({tries: 1, interval: 2000}, function (cb, r) {
          request({url: request_url, timeout:1000}, function (err, response, body) {
            // We want to error if err or 503
            var request_err = (err || response.statusCode==503);
            cb(request_err, response);
          });
        }, got_parse_js.bind(this));
      } else {
        debug('Using cached parse.js for ' + device_id);
      }

    } else {
      debug('Error getting full URL (' + short_url + ') after several tries.');
      try{
        debug('Trying to find cached urls. (' + device_id + ')');
        cacheString = fs.readFileSync('cached_urls.json', 'utf-8');
        this._cached_urls = JSON.parse(cacheString);
      } catch (e) {
        debug('Failed to find cached urls. (' + device_id + ')');
      }
    }
  };

  if (short_url in this._cached_urls) {
    // We already know what this URL expands to. Just use that.
    debug('Using cached url expansion for ' + device_id);
    got_expanded_url.call(this, null, this._cached_urls[short_url]);
  } else {
    // Try to expand the URL up to 10 times.
    async.retry(1, function (cb, r) { urlExpander.expand(short_url, cb); }, got_expanded_url.bind(this));
  }

};


// If this is true, we are running this file directly and should
// start the gateway.
if (require.main === module) {
    var argv = require('yargs')
        .help('h')
        .alias('h', 'help')
        .option('no-parse-payloads', {
            describe: 'this gateway should not parse payload',
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

    var bleg = new ThreadGateway();

    bleg.on('payload', function (adv_obj) {
        console.log(adv_obj);
    });

    bleg.on('local', function (local_obj) {
        console.log(local_obj);
    });

    bleg.start();

}else {
    module.exports = new ThreadGateway();
}
