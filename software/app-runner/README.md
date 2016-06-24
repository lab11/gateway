App Runner
==========

Automatically run .js apps on the gateway.

Configuration
-------------

Edit `/etc/swarm-gateway/app-runner.conf`:

    app_dir = <path to apps>


Usage
-----

Apps will be run if they are in the `app_dir` location specified in the .conf file.
To run, the app must be in a folder, and the folder must contain a `.js` file
with the same name as the folder. That `.js` file is what the `app-runner` will
execute. Apps should also be installed with their required `node_modules` folder.
