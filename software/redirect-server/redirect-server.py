#
# Redirect server to replace github content-type headers with the appropriate
# ones.
#

import mimetypes
import os

import flask
import requests

# Create simple flask app
app = flask.Flask(__name__)

# Handle all URLs here
@app.route('/<path:path>')
def all(path):
	# Get the content at the github page
	req = requests.get('https://raw.githubusercontent.com/{path}'.format(path=path))

	# Figure out the mimetype that should have gone with this file
	new_mimetype = mimetypes.guess_type(flask.request.base_url)[0]

	# Return to the client with the correct mimetype
	return flask.Response(req.text, mimetype=new_mimetype)

# Run server
if __name__ == '__main__':
	# Bind to PORT if defined, otherwise default to 5000.
	port = int(os.environ.get('PORT', 5000))
	app.run(host='0.0.0.0', port=port)
