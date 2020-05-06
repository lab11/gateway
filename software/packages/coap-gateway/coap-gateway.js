#!/usr/bin/env node

var events = require('events');
var url    = require('url');
var util   = require('util');
var Long   = require('long');

var coap                   = require('coap');
var server                 = coap.createServer();
var request                = require('request');
var urlExpander            = require('expand-url');
var _                      = require('lodash');
var debug                  = require('debug')('coap-gateway');
var watchout               = require('watchout');
var async                  = require('async');
var gatewayId              = require('lab11-gateway-id');
var fs                     = require('fs');
var protobuf               = require('protobufjs');
var tmp                    = require('tmp');

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

// Hardcoded constant for the name of the parsing file
var FILENAME_PARSE = 'parse.proto'

// Hardcoded constant for the timeout window to check for a new parse.js
var PARSE_JS_CACHE_TIME_IN_MS = 5*60*1000;

// Main object for the CoapGateway
var CoapGateway = function () {
    debug('Creating a new coap gateway');
    this._device_to_data = {};

    // Keep a map of URL -> parse.js parsers so we don't have to re-download
    // parse.js for the same devices.
    this._cached_parsers = {};

    // Keep track of shortened URLs to the full expanded URL so we don't
    // have to query each time we get a short URL
    this._cached_urls = {};

    // Keep track of in-progress block transfers
    this._block_transfers = {};

    that = this;
    let root = new protobuf.Root();
    root.load(__dirname + '/header.proto', {keepCase: true}, function(err) {
      if (err) throw err;
      that._header_parser = root.lookupType("Message");
    });

    server.on('request', this.on_request.bind(this));
    this._device_id_ages = {};
};

// We use the EventEmitter pattern to return parsed objects
util.inherits(CoapGateway, events.EventEmitter);

CoapGateway.prototype.blockTransferTimeout = function (tag) {
    debug(tag);
    debug(this);
    debug(this._block_transfers);
    clearTimeout(this._block_transfers[tag]["timer"]);
    delete this._block_transfers[tag];
    debug("Deleted", tag);
}

// Call .start() to run the gateway functionality
CoapGateway.prototype.start = function () {
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
CoapGateway.prototype.on_request = function (req, res) {
  var payload = req.payload;

  try {
    // if this is a block request, we can't parse until we have all the payload

    var blockOption = undefined;
    var etag        = undefined;
    for(var i = 0; i < req.options.length; i++) {
      if (req.options[i].name == 'Block1')
      {
        blockOption = req.options[i].value;
      }
      if (req.options[i].name == 'ETag')
      {
        etag = req.options[i].value;
      }
    }
    if (etag !== undefined && blockOption !== undefined) {
      let blockOptionInt = blockOption.readUIntBE(0, blockOption.length);
      let num = blockOptionInt >> 4;
      let more = (blockOptionInt & 8) >> 3;
      let szx = blockOptionInt & 0x7;
      debug("num/more/szx:", num.toString(10), more.toString(10), 1<<(4+szx));
      debug(this._block_transfers);
      let tag = etag + req.rsinfo.address;
      if (!(tag in this._block_transfers)) {
        this._block_transfers[tag] = {
          "data": payload,
          "timer": setTimeout(this.blockTransferTimeout.bind(this), 30000, tag),
        }
      } else {
        // TODO verify with block number + size that we are placing in correct location
        this._block_transfers[tag].data = Buffer.concat([this._block_transfers[tag].data, payload]);
        clearTimeout(this._block_transfers[tag].timer);
        this._block_transfers[tag].timer = setTimeout(this.blockTransferTimeout.bind(this), 30000, tag);

      }

      res.setOption('Block1', blockOption);
      if (more) {
        res.code = 231;
        res.end();
        return;
      } else {
        res.code = 204;
        res.end();
        payload = this._block_transfers[tag].data;
        // clear timer and get rid of reference
        clearTimeout(this._block_transfers[tag]["timer"]);
        delete this._block_transfers[tag];
      }
    }

    var err = this._header_parser.verify(payload);
    if (err) throw Error(err);

    var message = this._header_parser.toObject(this._header_parser.decode(payload));

    var device_id = message.header.id.toString('hex');
    var device_type = message.header.device_type;
    var seq_no = message.header.seq_no;
    var version = message.header.version;
    var topic = req.url.split('/');
    topic = topic[topic.length - 1];

    debug(req.url);
    if (req.url === "/discovery") {
      var parser_url = 'https://' + message.data.discovery
      this.get_parser(device_id, parser_url);
      return;
    }

    // Get the time
    var received_time = new Date();
    var timestamp = received_time.getTime();

    var usec;
    if (!("tv_usec" in message.header)) {
      usec = 0;
    } else {
      usec = message.header.tv_usec;
    }
    var sent_time = undefined
    if (message.header.tv_sec) {
      sent_time = new Date(message.header.tv_sec.toNumber()*1000 + usec/1000.0);
      debug(sent_time);
      if (Math.abs(timestamp - sent_time.getTime())/1000.0 < 2 && timestamp - sent_time.getTime() > 0) {
        timestamp = sent_time.getTime();
      }
      sent_time = sent_time.toISOString();
    }

    received_time = received_time.toISOString();

    // We have seen a discovery packet from the same address
    if (device_id in this._device_to_data) {
      debug("seen device before");
      // Lookup the correct device to get its parser URL identifier
      var device = this._device_to_data[device_id];

      // Check to see if a parser is available
      if (device.request_url in this._cached_parsers) {
        var parser = this._cached_parsers[device.request_url];
        debug("have parser already");

        // Unless told not to, we parse payloads
        if (am_submodule || !argv.noParsePayloads) {

          // Check if we have some way to parse the payload
          if (parser.parser) {
            var parse_payload_done = function (adv_obj) {

              // only continue if the result was valid
              if (adv_obj) {
                adv_obj.seq_no = seq_no;
                adv_obj.device = device_type;

                // Add a _meta key with some more information
                adv_obj._meta = {
                  topic: topic,
                  version: version,
                  timestamp: timestamp,
                  sent_time: sent_time,
                  received_time: received_time,
                  device_id:     device_id,
                  device:        device_type,
                  receiver:      'coap-gateway',
                  gateway_id:    this._gateway_id
                };

                // We broadcast on "payload"
                this.emit('payload', adv_obj);

                // Tickle the watchdog now that we have successfully
                // handled a pakcet.
                watchdog.reset();
              }
            };

            // Call the device specific payload parse function.
            // Give it the done callback.
            try {
              var err = parser.parser.verify(payload);
              if (err) throw err;
              var message = parser.parser.toObject(parser.parser.decode(payload), {bytes: String});
              parse_payload_done.bind(this)(message.data);

              res.code = 201;
              res.end();
            } catch (e) {
              debug(e);
              debug('Error calling parse function for ' + device_id + '\n' + e);
              res.code = 415;
              res.end('Error calling parse function for ' + device_id + '\n');
            }
          }
        }
      }
    // If we don't have this device's parser, return 4.04 Not Found
    } else {
      debug("Could not find parser for " + device_id);
      res.code = 404;
      res.end("Could not find parser for " + device_id + "\n");
    }
  } catch(e) {
    debug(e);
  }
};

// We want just the base URL.
// So, something like "https://a.com/folder/page.html?q=1#here"
// should turn in to "https://a.com/folder/"
// function get_base_url (full_url) {
CoapGateway.prototype.get_base_url = function (full_url) {
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
CoapGateway.prototype.get_parser = function (device_id, parser_url) {
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

          // Create tmp file for parse.proto
          var that = this;
          try {
            tmp.file({ mode: 0644, postfix: '.proto' }, function (err, path, fd) {
              if (err) throw err;

              fs.write(fd, response.body, function (err, written, string) {
                // Store this in the known parsers object
                that._cached_parsers[request_url] = {};
                that._cached_parsers[request_url].proto_file = path;
                // fs.writeFileSync('cached_parsers.json', JSON.stringify(that._cached_parsers));

                // Check the downloaded parse.proto is valid
                let root = new protobuf.Root();
                root.load(path, {keepCase: true}, function(err) {
                  if (err) throw err;

                  var parser = root.lookupType("Message");
                  that._cached_parsers[request_url].parser = parser;
                  that._device_id_ages[device_id] = Date.now();
                });
              });
            });
          } catch (e) {
            debug('Failed to parse payload after fetching parser');
          }

        } else {
          debug('Could not fetch parse.js after trying multiple times. (' + device_id + ')');
          try {
            debug('Trying to find cached parser. (' + device_id + ')');
            // TODO figure this shit out:
            //cacheString = fs.readFileSync('cached_parsers.json', 'utf-8');
            //this._cached_parsers = JSON.parse(cacheString);
            //for (var r_url in this._cached_parsers) {
            //  var parser = this.require_from_string(this._cached_parsers[r_url]['parse.js'], r_url);
            //  this._cached_parsers[r_url].parser = parser;
            //}

            ////update the cache to indicate we actually have this parser
            //this._device_id_ages[device_id] = Date.now();
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

    var coapg = new CoapGateway();

    coapg.on('payload', function (adv_obj) {
        console.log(adv_obj);
    });

    coapg.start();

}else {
    module.exports = new CoapGateway();
}
