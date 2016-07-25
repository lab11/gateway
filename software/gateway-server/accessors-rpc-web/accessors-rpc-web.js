var express      = require('express');
var nunjucks     = require('nunjucks');
var bodyParser   = require('body-parser');
var accessorHost = require('accessors-js-ucb');

var app = express();

// POST parsing
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

// Hook in our static too
app.use('/static', express.static(__dirname + '/static'));

// Setup nunjucks
var nunjucksEnv = new nunjucks.Environment(new nunjucks.FileSystemLoader(__dirname + '/templates'));


/*******************************************************************************
 * Local state
 ******************************************************************************/

// The accessor that is loaded
var accessor_name = undefined;
var accessor = undefined;


/*******************************************************************************
 * End points
 ******************************************************************************/

// POST a JSON object of {input_name: value} to set input ports then react
app.post('/:device_name/react', function (req, res) {
	var device_name = req.params.device_name;

	// Check that this matches up with our current accessor
	if (accessor_name === device_name && accessor) {

		// Set all of the inputs we were given.
		for (var input_name in req.body) {
			accessor.provideInput(input_name, req.body[input_name]);
		}

		// Do the magic!
		accessor.react();

		// Respond
		res.json({status: 'success'});
	} else {
		res.json({
			status: 'error',
			message: 'Incorrect accessor found.'
		});
	}

});


/*******************************************************************************
 * Helper functions
 ******************************************************************************/

// Make HTML to display a way to interact with an accessor
function render_accessor_html (device_name, accessor_url, accessor_code, parameters) {

	function accessor_fetch (name) {
		return accessor_code;
	}

	function require_remap (mod) {
		return require('accessors-js-ucb/modules/' + mod);
	}

	accessor_name = device_name;
	accessor = new accessorHost.instantiateAccessor(device_name,
	                                                accessor_url,
	                                                accessor_fetch,
	                                                {require: require_remap});

	// Get it running
	accessor.initialize();

	// Set parameters
	for (var parameter_name in accessor.parameters) {
		if (parameter_name in parameters) {
			accessor.setParameter(parameter_name, parameters[parameter_name]);
		}
	}

	// Prepare items to pass to the nunjucks template
	var inputs = [];
	for (var input in accessor.inputs) {
		var new_input = {name: input};
		new_input.type = accessor.inputs[input].type;
		new_input.value = accessor.inputs[input].value;
		inputs.push(new_input);
	}

	var outputs = [];
	for (var output in accessor.outputs) {
		var new_output = {name: output};
		new_output.type = accessor.outputs[output].type;
		new_output.value = accessor.outputs[output].value;
		outputs.push(new_output);
	}

	var tmpl = nunjucksEnv.getTemplate('accessor.nunjucks');
	var html = tmpl.render({
		name: device_name,
		inputs: inputs,
		outputs: outputs
	});

	return html;
}

module.exports = {
	app: app,
	render_accessor_html: render_accessor_html
};
