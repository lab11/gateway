#! /usr/bin/env node
/* Log process status to Sensu */

// Libraries
var debug = require('debug')('sensu-process');

var fs     = require('fs');
var ini    = require('ini');
var getmac = require('getmac');
var amqp   = require('amqp');

// Code
var SensuProcess = function () {
    // how often keepalive packets should be sent
    this._rate_limit = 60;
    this._last_transmission_time = 0;
    
    this._amqp_config = undefined;
    this._amqp_exchange = undefined;
    this._initialized = false;
};

SensuProcess.prototype.init = function (config_path, process_name) {
    // config_path - string, path to valid sensu.conf file
    // process_name - string, name of process to be sent to sensu

    try {
        var config_file = fs.readFileSync(config_path, 'utf-8');
        var config = ini.parse(config_file);
        if (!config.host || !config.port || !config.vhost ||
                !config.user || !config.password) {
            throw new Exception('no settings');
        }
        this._amqp_config = config;
    } catch (e) {
        debug("Initialization error: ");
        debug(e);
        throw new Exception("Could not find valid sensu.conf file");
    }

    // process name string is alphanumeric plus '_' and '-'
    if (!process_name) {
        throw new Exception("Invalid process name");
    }
    this._process_name = process_name.replace(/[^a-zA-Z0-9-_]/g, '');

    debug("Initialization complete");
    this._initialized = true;
};

SensuProcess.prototype.begin = function (automatic, send_rate) {
    // automatic - boolean, true=send keepalive at `send_rate` interval
    // send_rate - integer, minimum seconds between keepalive transmissions

    // must be initialized before starting
    if (!this._initialized) {
        throw new Exception("sensu-process must be initialzed before starting!");
    }

    // set max rate at which keepalives are delivered
    if (send_rate) {
        this._rate_limit = send_rate;
    }

    // get mac address for keepalives
    var that = this;
    getmac.getMac(function (error, macaddr) {
        that._process_macaddr = macaddr
        debug("Using MAC address: " + that._process_macaddr);

        // create amqp connection
        var amqp_conn = amqp.createConnection({
                host:     that._amqp_config.host,
                port:     that._amqp_config.port,
                vhost:    that._amqp_config.vhost,
                login:    that._amqp_config.user,
                password: that._amqp_config.password});
        amqp_conn.on('ready', function () {
            debug("Connected to AMQP: " + that._amqp_config.host);
            amqp_conn.exchange('keepalives', {type: 'direct', autoDelete: false}, function (exchange) {
                debug("Connected to exchange 'keepalives'");
                that._amqp_exchange = exchange;

                // automatically send keepalive if desired
                if (automatic) {
                    setInterval(that.keepalive, that._rate_limit*1000);
                }

                // send initial keepalive
                that.keepalive();
            });
        });
    });
};

SensuProcess.prototype.keepalive = function () {
    if (!this._amqp_exchange) {
        debug("Keepalive requested while exchange invalid");
        return;
    }
    if (!this._initialized) {
        debug("Keepalive requested before initialization complete");
        return;
    }

    // rate limit keepalive transmission
    var now = Date.now()/1000;
    if (now - this._last_transmission_time >= this._rate_limit) {
        this._last_transmission_time = now;

        // create keepalive message
        var msg = {
            name: this._process_name +'-' + this._process_macaddr.replace(/:/g, ''),
            subscriptions: [],
            address: this._process_macaddr,
            version: '0.22.2',
            timestamp: Math.floor(now),
        };

        this._amqp_exchange.publish('', msg, {}, function (err) {
            debug("Error when publishing keepalive");
        });
    } else {
        debug("Rate limited keepalive");
    }
};

module.exports = new SensuProcess();
