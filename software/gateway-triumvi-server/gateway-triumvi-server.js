#!/usr/bin/env node

/*******************************************************************************
 * Create a simple webserver for Triumvi Gateways
 ******************************************************************************/

var fs         = require('fs');

var express    = require('express');
var nunjucks   = require('nunjucks');
var bodyParser = require('body-parser');
var sqlite3    = require('sqlite3');
var async      = require('async');
var ini        = require('ini');


var app = express();

// Static
app.use('/static', express.static(__dirname + '/static'));

// And we actually want to be able to receive posts
app.use(bodyParser.urlencoded({ extended: true}));

var nunjucksEnv = nunjucks.configure(__dirname + '/templates', {watch: true});

// Read in the config file to get the sqlite db filename
try {
    var config_file = fs.readFileSync('/etc/swarm-gateway/triumvi-sqlite.conf', 'utf-8');
    var config = ini.parse(config_file);
    if (config.database_file == undefined || config.database_file == '') {
        throw new Exception('no settings');
    }
} catch (e) {
	console.log(e)
    console.log('Could not find /etc/swarm-gateway/triumvi-sqlite.conf or not configured correctly.');
    process.exit(1);
}


/*******************************************************************************
 * API Services
 ******************************************************************************/


/*******************************************************************************
 * ROUTES
 ******************************************************************************/

// Display a list of found devices
app.get('/', function (req, res) {
	var tmpl = nunjucksEnv.getTemplate('index.nunjucks');
	var html = tmpl.render();
	res.send(html);
});

// Show a graph of a value in real time
app.get('/triumvi/data', function (req, res) {

	// Fill in the form with valid data based on which Triumvis have been
	// seen so far.
	var data = {
		triumvi_ids: [],
		panel_ids: [],
		circuit_ids: [],
	};

	var db = new sqlite3.Database(config.database_file);

	function get_triumvi_ids (cb) {
		db.all('SELECT DISTINCT triumvi_id FROM triumvi ORDER BY triumvi_id', function (err, rows) {
			for (var i=0; i<rows.length; i++) {
				data.triumvi_ids.push(rows[i].TRIUMVI_ID);
			}
			cb();
		});
	}

	function get_panel_circuit_ids (cb) {
		db.all('SELECT DISTINCT panel_id FROM triumvi WHERE panel_id NOT NULL ORDER BY panel_id', function (err, rows) {
			for (var i=0; i<rows.length; i++) {
				data.panel_ids.push(rows[i].PANEL_ID);
			}

			db.all('SELECT DISTINCT circuit_id FROM triumvi WHERE panel_id NOT NULL ORDER BY circuit_id', function (err, rows) {
				for (var i=0; i<rows.length; i++) {
					data.circuit_ids.push(rows[i].CIRCUIT_ID);
				}
				cb();
			});
		});
	}

	async.series([get_triumvi_ids, get_panel_circuit_ids], function (err, results) {
		var tmpl = nunjucksEnv.getTemplate('triumvi.nunjucks');
		var html = tmpl.render(data);
		res.send(html);
	});
});

app.post('/triumvi/data/download', function (req, res) {
	console.log(req.body)

	var query = 'SELECT ';
	var group_by = '';
	var param = {};
	var filename = 'triumvi_';
	var minutes = null;

	// Time resolution changes our select query
	if (req.body.resolution == 'all') {
		query += '* ';
	} else {
		// Use GROUP BY and AVG to downsample the data.
		minutes = parseInt(req.body.resolution.substr(0, req.body.resolution.length-3));
		query += 'ROUND(timestamp/($minutes * 60 * 1000)) AS timekey, AVG(power_watts) as POWER_WATTS ';
		param.$minutes = minutes;
		group_by = 'GROUP BY timekey ';
	}

	// Need table
	query += 'FROM triumvi ';

	// Filter for which triumvis
	if (req.body.which == 'panel-circuit') {
		query += 'WHERE panel_id=$panel_id AND circuit_id=$circuit_id ';
		param.$panel_id = req.body.panel;
		param.$circuit_id = req.body.circuit;
		filename += 'panel-' + req.body.panel + '_';
		filename += 'circuit-' + req.body.circuit + '_';
	} else if (req.body.which == 'triumvi-id') {
		query += 'WHERE triumvi_id=$triumvi_id ';
		param.$triumvi_id = req.body['triumvi-id'];
		filename += 'triumviid-' + req.body['triumvi-id'] + '_';
	} else if (req.body.which == 'all') {
		query += 'WHERE ROWID>=0 ';
		filename += 'all_';
	}

	// Filter for time
	if (req.body.start != '') {
		query += 'AND timestamp>$start ';
		param.$start = new Date(req.body.start);
		filename += param.$start.toISOString() + '_';
	} else {
		filename += 'start_';
	}
	if (req.body.end != '') {
		query += 'AND timestamp<$end ';
		param.$end = new Date(req.body.end);
		filename += param.$end.toISOString() + '_';
	} else {
		filename += 'end_';
	}

	// Might need group by. group_by may also be just an empty string.
	query += group_by;

	// Resolution
	filename += req.body.resolution;

	// Filetype
	filename += '.' + req.body.format;




	console.log(query)
	console.log(param)
	console.log(filename)



	// Headers for the CSV file.
	var HEADERS = ['TRIUMVI_ID', 'TIMESTAMP', 'POWER_WATTS', 'POWER_FACTOR',
	               'VOLTAGE_RMS_VOLTS', 'CURRENT_RMS_AMPS', 'PANEL_ID', 'CIRCUIT_ID'];

	// Use a local file to store the resulting data, then let the user download
	// that file.
	var file = fs.openSync(filename, 'w');

	if (req.body.format == 'csv') {
		// Add first row
		if (req.body.resolution == 'all') {
			for (var i=0; i<HEADERS.length; i++) {
				fs.writeSync(file, HEADERS[i]);
				if (i == HEADERS.length-1) {
					fs.writeSync(file, '\n');
				} else {
					fs.writeSync(file, ',');
				}
			}
		} else {
			// Data was downsampled.
			fs.writeSync(file, 'TIMESTAMP,POWER_WATTS\n');
		}
	}

	// Setup the connection to the DB and run the query.
	var db = new sqlite3.Database(config.database_file);
	db.each(query, param, function (err, row) {

		// Write the data to the file.
		if (req.body.format == 'json') {
			if (req.body.resolution != 'all') {
				// In downsample mode we need to fix up the time key.
				row.TIMESTAMP = row.timekey * minutes * 60 * 1000;
				delete row.timekey;
			}
			fs.writeSync(file, JSON.stringify(row) + '\n');

		} else if (req.body.format == 'csv') {
			var str = '';

			if (req.body.resolution == 'all') {
				for (var i=0; i<HEADERS.length; i++) {
					str += row[HEADERS[i]];
					if (i == HEADERS.length-1) {
						str += '\n';
					} else {
						str += ',';
					}
				}
			} else {
				// Only timestamp and power
				str += row.timekey * minutes * 60 * 1000 + ',' + row.POWER_WATTS + '\n';
			}
			fs.writeSync(file, str);
		}
	}, function () {
		console.log('done');
		fs.closeSync(file);
		res.download(filename);
	});
});

/*******************************************************************************
 * MAIN CODE
 ******************************************************************************/

// Run the webserver
var server = app.listen(8080, function () {
	var host = server.address().address;
	var port = server.address().port;

	console.log('Listening for devices at http://%s:%s', host, port);
});
