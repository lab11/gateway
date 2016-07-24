var express = require('express');
var nunjucks = require('nunjucks');
var bodyParser = require('body-parser');

var accessorHost = require('accessors-js-ucb');

var app = express();

// POST parsing
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
// console.log(__dirname + '/templates')
// nunjucks.configure(__dirname + '/templates', {
// 	autoescape: true,
// 	express: app
// });

var nunjucksEnv = new nunjucks.Environment(new nunjucks.FileSystemLoader(__dirname + '/templates'));


/*******************************************************************************
 * Local state
 ******************************************************************************/

// The accessor that is loaded
var accessor = undefined;



app.post('/:device_name/react', function (req, res) {
});


function render_accessor_html (device_name, accessor_url, accessor_code, parameters) {

	function accessor_fetch (name) {
		return accessor_code;
	}

	function require_remap (mod) {
		return require('accessors-js-ucb/modules/' + mod);
	}

	accessor = new accessorHost.instantiateAccessor(device_name,
	                                                accessor_url,
	                                                accessor_fetch,
	                                                {require: require_remap});

	// Get it running
	accessor.initialize();

	// Set parameters
	for (var parameter_name in accessor.parameters) {
		if (parameter_name in parameters) {
			console.log('setting parameter ' + parameter_name + ' to ' + parameters[parameter_name])
			accessor.setParameter(parameter_name, parameters[parameter_name]);
		}
	}
	// for (var parameter_name in parameters) {
	// 	accessor.setParameter(parameter_name, parameters[parameter_name]);
	// }

	// console.log(accessor)

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

	console.log(inputs)
	console.log(outputs)

	var nunjucks_params = {
		name: device_name,
		inputs: inputs,
		outputs: outputs
	}

	console.log(nunjucks)

	var tmpl = nunjucksEnv.getTemplate('accessor.nunjucks');
	var html = tmpl.render({
		accessor: nunjucks_params
	});

	// var html = nunjucks.render('accessor.nunjucks', {
	// 	accessor: nunjucks_params
	// });

	return html;
}



module.exports = {
	app: app,
	render_accessor_html: render_accessor_html
};
