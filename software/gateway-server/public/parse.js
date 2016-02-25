
// parse eddystone advertisement and return the IP address of the gateway
var parse_advertisement = function (advertisement, cb) {

    // check packet validity
    if (advertisement.localName && advertisement.serviceData) {
        if (advertisement.localName === "swarmgateway") {
            if (advertisement.serviceData.length >= 1) {

                // parse out IP address from eddystone packet
                var ip_addr;
                for (var i=0; i<advertisement.serviceData.length; i++) {
                    var service = advertisement.serviceData[i];
                    if (service.uuid.toUpperCase() == "FEAA") {
                        var data = service.data;

                        // check for invalid packets
                        if (data[0] != 0x10) {
                            cb(null);
                            return;
                        }   

                        // create url string
                        //  we don't want the http prefix or trailing TLD
                        ip_addr = data.slice(3).toString();
                    }
                }

                var out = {
                    device: 'SwarmGateway',
                    ip_address: ip_addr,
                }

                cb(out);
                return;
            }
        }
    }

    cb(null);
}


module.exports = {
    parseAdvertisement: parse_advertisement
};
