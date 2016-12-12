#!/usr/bin/env node

/*******************************************************************************
 * Create a simple webserver for Triumvi Gateways
 ******************************************************************************/

var fs         = require('fs');

var express    = require('express');
var nunjucks   = require('nunjucks');
var bodyParser = require('body-parser');
var sqlite3    = require('sqlite3');
// var prettyjson = require('prettyjson');
// var getmac     = require('getmac');
var async      = require('async');
// var request    = require('request');

var app = express();

// Static
app.use('/static', express.static(__dirname + '/static'));

// And we actually want to be able to receive posts
app.use(bodyParser.urlencoded({ extended: true}));

var nunjucksEnv = nunjucks.configure(__dirname + '/templates', {watch: true});

// // Setup templates
// var nunjucksEnv = new nunjucks.Environment(new nunjucks.FileSystemLoader(__dirname + '/templates'));

// nunjucksEnv.addFilter('is_object', function(obj) {
//   return typeof obj === 'object';
// });

// nunjucksEnv.configure({watch: true});
var config = {};
config.database_file = '/home/bradjc/git/gateway/software/gateway-triumvi-sqlite/triumvi.sqlite';


/*******************************************************************************
 * SQL
 ******************************************************************************/


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

	var query = 'SELECT * FROM triumvi ';
	var param = {};
	var filename = 'triumvi_';

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

	// Filetype
	filename += '.' + req.body.format;




	console.log(query)
	console.log(param)
	console.log(filename)



	var HEADERS = ['TRIUMVI_ID', 'TIMESTAMP', 'POWER_WATTS', 'POWER_FACTOR',
	               'VOLTAGE_RMS_VOLTS', 'CURRENT_RMS_AMPS', 'PANEL_ID', 'CIRCUIT_ID'];

	var file = fs.openSync(filename, 'w');

	if (req.body.format == 'csv') {
		// Add first row
		for (var i=0; i<HEADERS.length; i++) {
			fs.writeSync(file, HEADERS[i]);
			if (i == HEADERS.length-1) {
				fs.writeSync(file, '\n');
			} else {
				fs.writeSync(file, ',');
			}
		}
	}

	var db = new sqlite3.Database(config.database_file);
	db.each(query, param, function (err, row) {

		if (req.body.format == 'json') {
			fs.writeSync(file, JSON.stringify(row) + '\n');

		} else if (req.body.format == 'csv') {
			var str = '';
			for (var i=0; i<HEADERS.length; i++) {
				str += row[HEADERS[i]];
				if (i == HEADERS.length-1) {
					str += '\n';
				} else {
					str += ',';
				}
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
