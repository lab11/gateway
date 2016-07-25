
function accessor_alert_error (accessor_block, error_str) {
	html = '<div class="alert alert-danger" role="alert">'+error_str+'</div>';
	accessor_alert_clear(accessor_block);
	$(accessor_block).find('.accessor-alerts').html(html);
}

function accessor_alert_success (accessor_block, success_str) {
	html = '<div class="alert alert-success" role="alert">'+success_str+'</div>';
	accessor_alert_clear(accessor_block);
	$(accessor_block).find('.accessor-alerts').html(html);
}

function accessor_alert_clear (accessor_block) {
	$(accessor_block).find('.accessor-alerts').empty();
}

// When "react!" button is pressed
$('.accessor-react').click(function() {

	var accessor_parent = $(this).parents('.accessor');
	var accessor_name = $(accessor_parent).attr('data-name');

	var inputs = $(accessor_parent).find('.accessor-input');

	var input_data = {};

	for (var i=0; i<inputs.length; i++) {
		var input = inputs[i];
		var input_name = $(input).attr('data-name');

		// Get the value of this port
		var input_element = $(input).find('.accessor-input-element');
		var input_element_type = input_element[0].type;

		var input_element_value = undefined;
		if (input_element_type === 'checkbox') {
			input_element_value = $(input_element).is(':checked');
		} else if (input_element_type === 'text') {
			input_element_value = $(input_element).val();
		} else if (input_element_type === 'textarea') {
			input_element_value = $(input_element).val();
		}

		// Store the result for posting to the server
		input_data[input_name] = input_element_value;
	}

	// And make the request for the accessor to do something
	var request = $.ajax({
		url: '/accessors/' + accessor_name + '/react',
		type: 'POST',
		data: input_data,
		success: function (data) {
			if (data.status === 'success') {
				accessor_alert_success(accessor_parent, 'Accessor reacted successfully!');
			} else {
				accessor_alert_error(accessor_parent, 'Accessor failure: ' + data.message);
			}
		},
		error: function (err) {
			console.log('ERRRRRRR')
			console.log(err)
		}
	});

});
