var express = require('express');
var nunjucks = require('nunjucks');
var bodyParser = require('body-parser');

var app = express();

// Static
app.use('/static', express.static(__dirname + '/static'));

// POST parsing
app.use(bodyParser.urlencoded({extended: true}));

nunjucks.configure('templates', {
	autoescape: true,
	express: app
});


/*******************************************************************************
 * Local state
 ******************************************************************************/

// status = {
//  group: {
//   status-item: value
//  }
// }
var statuses = {};

var DEFAULT_GROUP = 'Global';


app.get('/', function (req, res) {
	res.render('index.nunjucks', {
		statuses: statuses
	});
});

app.post('/update', function (req, res) {

	// Get the group of this status item
	var group = DEFAULT_GROUP;
	if ('group' in req.body) {
		group = req.body.group;
	}

	// Get the actual name
	var key = req.body.key;

	// Get the status
	var value = req.body.value;

	if (key !== undefined && value !== undefined) {
		// Got a valid status update
		if (!(group in statuses)) {
			statuses[group] = {};
		}
		statuses[group][key] = value;
	}

	res.locals.ws.clients.forEach(function (client) {
		try {
			client.send(JSON.stringify({
				group: group,
				key: key,
				value: value,
			}));
		} catch (e) { }
	});

	res.end();
});


module.exports = app;
