var request = require('request');

var parse_advertisement = function (advertisement) {
	request('http://www.google.com', function (error, response, body) {
	  if (!error && response.statusCode == 200) {
	    console.log(body) // Show the HTML for the Google homepage.
	  }
	});


	return {
		field: 'value',
	};
}



module.exports = {
	parseAdvertisement: parse_advertisement
};
