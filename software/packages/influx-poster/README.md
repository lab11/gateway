Influx-Poster
=============

POST data to InfluxDB in batches.

This library accepts data elements, formats them as expected by InfluxDB,
stores them, and periodically POSTs batches of data to an InfluxDB server.


# Usage

```
var InfluxPoster = require('influx-poster');

// read in config file...

var influx_poster = new InfluxPoster({
    host: config.host,
    database: config.database,
    port: config.port,
    protocol: config.protocol,
    username: config.username,
    password: config.password,
}, 200000, 15*1000);


function on_data (data) {

    var key = data.name;

    var tags = {
        device_id: data.device_id;
    };

    var fields = {
        value: data.value;
    };

    var timestamp = data.time;

    var point = [
        key,
        tags,
        fields,
        timestamp
    ];
    influx_poster.write_data(point);
}

```

# API

### new InfluxPoster(user_config, maximum_lines, maximum_time)

Initialize influx-poster.

**`user_config`**: configuration dictionary for influx database with the following keys

    mandatory

        host     - hostname for influxDB server
        database - specific database name to post to

    optional

        port      - influxDB server port, default 8086
        protocol  - POST method (http or https), default http
        username  - username of database, default ''
        password  - password for database, default ''
        prefix    - path prefix before command, default ''
        precision - precision key for influx, default 'ms'
        retention_policy - retention_policy key for influx, default ''
        gzip      - compress the http POST message, default 'true'

**`maximum_lines`**: maximum number of lines to be stored before posting

**`maximum_time`**: maximum amount of time before posting, in milliseconds.

If neither `maximum_lines` nor `maximum_time` are specified, `maximum_time` defaults to 30 seconds.


### write_data(point, callback)

Stores a data point to be automatically written when either `maximum_lines` or `maximum_time` is met.

**`point`**: data array in the following format

        [
            key,        // mandatory
            { tags },   // optional, may be empty dict
            { fields }, // at least one field is mandatory
            timestamp,  // optional, may omit
        ]

Ensure that all values in `fields` are already the type you want them to be
in influxDB. Boolean, Float, and String are valid.

Ensure that timestamp is already in the correct format based on the
`precision` configuration setting.

See [https://docs.influxdata.com/influxdb/v0.13/write_protocols/line/](https://docs.influxdata.com/influxdb/v0.13/write_protocols/line/)


**`callback`**: function to be called once complete


