/*
 * Very basic tool to publish that the gateway exists over SSDP/UPnP
 */

var ssdp = require('node-ssdp');

var ssdpServer = new ssdp.Server();

var CUSTOM_GATEWAY_URN = 'urn:TerraSwarm:gateway:1';

ssdpServer.addUSN(CUSTOM_GATEWAY_URN);
ssdpServer.start();
