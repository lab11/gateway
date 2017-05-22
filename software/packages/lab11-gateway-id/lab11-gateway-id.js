/*
Returns a string (via callback) that identifies a gateway.

Uses this logic to determine an ID.

1. Reads /factory/gateway_id and uses its contents if it exists.
2. Calls `getmac.getMac()` and returns it if it exists.
3. Reads /etc/machine-id and uses it if it exists.
*/

var fs     = require('fs');

var getmac = require('getmac');

function id (cb) {
    // Try to read from /factory/gateway_id.
    try {
        var gateway_id = fs.readFileSync('/factory/gateway_id', 'utf-8').trim();
        cb(gateway_id);
    } catch (e) {
        // Try to use the MAC address
        getmac.getMac(function(err, addr) {
            if (err) {
                try {
                    // Try to use /etc/machine-id
                    var gateway_id = fs.readFileSync('/etc/machine-id', 'utf-8').trim();
                    cb(gateway_id);
                } catch (e) {
                    cb('');
                }
            }
            cb(addr);
        });
    }
}

module.exports = {
    id: id
};
