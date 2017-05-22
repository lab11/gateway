Gateway ID
==========

Get a gateway ID from the current running gateway.

```node
var gateway_id = require('labll-gateway-id');

gateway_id.id(function (id) {
	console.log('Gateway ID is ' + id);
});
```
