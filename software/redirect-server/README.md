Redirect Server
===============

This flask app runs a webserver that takes in URLs, fetches the content
from that URL from github, and returns the content to the client with
the correct `content-type` header. This allows for web content to be
trivially hosted on github and to workaround the forced text mimetype
that github serves.

Example
-------

    http://localhost:5000/lab11/gateway/master/devices/test/parse.js

returns the content at

    https://raw.githubusercontent.com/lab11/gateway/master/devices/test/parse.js

but with the mimetype `text/javascript` instead of `text/plain`.


Installation
------------

    sudo pip3 install flask requests
    python3 ./redirect-server.py
