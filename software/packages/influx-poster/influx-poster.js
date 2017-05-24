// Takes in data, converts to InfluxDB format, and batches POSTs to an InfluxDB server

var request = require('request');
var url     = require('url');
var debug   = require('debug')('influx-poster');
var zlib    = require('zlib');

// user_config: configuration dictionary for influx database with the following keys
//  mandatory
//      host     - hostname for influxDB server
//      database - specific database name to post to
//  optional
//      port      - influxDB server port, default 8086
//      protocol  - POST method (http or https), default http
//      username  - username of database, default ''
//      password  - password for database, default ''
//      prefix    - path prefix before command, default ''
//      precision - precision key for influx, default 'ms'
//      retention_policy - retention_policy key for influx, default ''
// maximum_lines: maximum number of lines to be stored before posting
// maximum_time: maximum amount of time before posting
var InfluxPoster = function (user_config, maximum_lines, maximum_time) {
    debug("Creating new InfluxPoster");

    // Store data to be posted
    this._data_lines = [];

    // handle input arguments
    config = {
        host: '',
        database: '',
        port: 8086,
        protocol: 'http',
        username: '',
        password: '',
        prefix: '',
        precision: 'ms',
        retention_policy: '',
        gzip: true,
    };
    if (user_config && typeof user_config == 'object' &&
            'host' in user_config && 'database' in user_config) {
        config.host     = user_config.host;
        config.database = user_config.database;
        if ('port'      in user_config) config.port      = user_config.port;
        if ('protocol'  in user_config) config.protocol  = user_config.protocol;
        if ('username'  in user_config) config.username  = user_config.username;
        if ('password'  in user_config) config.password  = user_config.password;
        if ('prefix'    in user_config) config.prefix    = user_config.prefix;
        if ('precision' in user_config) config.precision = user_config.precision;
        if ('retention_policy' in user_config) config.retention_policy = user_config.retention_policy;
        if ('gzip'      in user_config) config.gzip      = (user_config.gzip == 'true');
    } else {
        return new Error("Invalid configuration");
    }
    this._max_lines = 0;
    if (maximum_lines && typeof maximum_lines == 'number' && maximum_lines > 0) {
        this._max_lines = maximum_lines;
    }
    this._max_time = 0;
    if (maximum_time && typeof maximum_time == 'number' && maximum_time > 0) {
        this._max_time = maximum_time;
    }

    // if neither a max_lines nor a max_time were selected,
    //  just post every 30 seconds
    if (this._max_lines == 0 && this._max_time == 0) {
        this._max_time = 30*1000;
    }

    // create influx query
    var query = {};
    query.db = config.database;
    if (config.username  != '') query.u = config.username;
    if (config.password  != '') query.p = config.password;
    if (config.precision != '') query.precision = config.precision;
    if (config.retention_policy != '') query.rp = config.retention_policy;

    this._post_url = url.format({
        protocol: config.protocol,
        hostname: config.host,
        port:     config.port,
        pathname: config.prefix + 'write',
        query:    query,
    });
    debug("Influx POST URL: " + this._post_url);

    // Set whether we want to compress or not
    this._gzip = config.gzip;

    // start timer
    if (this._max_time > 0) {
        var that = this;
        setTimeout(function () {
            that.post_data();
        }, this._max_time);
    }
};

// expects a data point array in the following format
//  [
//      key,        // mandatory
//      { tags },   // optional, may be empty dict
//      { fields }, // at least one field is mandatory
//      timestamp,  // optional, may omit
//  ]
// Note 1: Ensure that all values in `fields` are already the type you want
//  them to be in influxDB. Boolean, Float, and String are valid
// Note 2: Ensure that timestamp is already in the correct format
// https://docs.influxdata.com/influxdb/v0.13/write_protocols/line/
InfluxPoster.prototype.write_data = function (point, callback) {

    var key = point[0];
    var tags = point[1];
    var fields = point[2];
    var timestamp = point[3];

    // properly escape or remove invalid characters
    function fixup_tag (s) {
        return s.replace(/ /g, '\\ ').replace(/,/g, '\\,').replace(/=/g, '\\=').replace(/"/g, '');
    }

    // parse data into proper format
    var line = '';
    line += fixup_tag(key);

    if (tags) {
        // tags should be sorted for best performance, but we're a _bit_ less
        //  performant than the server is, so we'll just let it work a little
        //  harder here
        for (var tag_name in tags) {
            var tag_value = '' + tags[tag_name];

            line += ',';
            line += fixup_tag(tag_name);
            line += '=';
            line += fixup_tag(tag_value);
        }
    }

    line += ' ';
    var first_time = true;
    for (var field_name in fields) {
        var field_value = fields[field_name];

        if (!first_time) {
            line += ',';
        }
        first_time = false;

        line += fixup_tag(field_name);
        line += '=';

        if (typeof field_value === 'string') {
            line += '"' + field_value.replace(/"/g, '\\"') + '"';
        } else {
            line += field_value;
        }
    }

    if (timestamp) {
        line += ' ';
        line += timestamp;
    }

    // append data to _data_lines
    this._data_lines.push(line);

    // check if we should post data
    if (this._max_lines > 0 &&
            this._data_lines.length >= this._max_lines) {
        this.post_data(callback);

    } else {
        if (callback) {
            callback();
        }
    }
};

InfluxPoster.prototype.post_data = function (callback) {
    debug("Posting data!");

    if (this._data_lines.length > 0) {
        var that = this;
        var post_body = this._data_lines.join('\n');

        // Clear data array. This does drop data if there is an error,
        // but better than letting it pile up until we run out of memory.
        this._data_lines = [];

        function send (options) {
            debug("POSTing at " + Date.now()/1000);

            request(options, function (err, response) {

                if (err) {
                    debug("Influx POST error: " + err);
                    debug(response);

                    // should do something with the error here...
                } else {
                    debug("POST successful at " + Date.now()/1000)
                }

                // restart timer
                if (that._max_time > 0) {
                    setTimeout(function () {
                       that.post_data();
                    }, that._max_time);
                }

                if (callback) {
                    callback();
                }
            });
        }

        // Check if we should compress the body before POSTing it.
        if (this._gzip) {
            zlib.gzip(post_body, function (gzip_err, compressed) {
                var options = {
                    method: 'POST',
                    url: that._post_url,
                    body: compressed,
                    headers: {'Content-Encoding': 'gzip'},
                };
                send(options);
            });
        } else {
            var options = {
                method: 'POST',
                url: that._post_url,
                body: post_body,
            };
            send(options);
        }

    } else {
        // no data, continue immediately

        // restart timer
        if (this._max_time > 0) {
            var that = this;
            setTimeout(function () {
                that.post_data();
            }, this._max_time);
        }

        if (callback) {
            callback();
        }
    }
};

module.exports = InfluxPoster;
