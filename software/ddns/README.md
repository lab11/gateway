Dynamic DNS
===========

_Note: This README covers `software/ddns` and `cron/ddns`_

Dynamic DNS will automatically update a DNS server with the current IP of this
device. This uses the standard Dynamic DNS Update requests as defined in RFC
2136, and thus should work with any standard DNS server.

Currently, devices will automatically register themselves with a DNS entry of
`MAC_ADDRESS.device.lab11.eecs.umich.edu`.


Requirements
------------

You will need Python3, the `dnspython3` package for Python3, and the `nsupdate`
utility, which is found in `dnsutils` in `apt`.


Configuration
-------------

You will need to set up dynamic DNS support on a DNS server that you
have access to to support ddns. **Be careful with trailing `.`s throughout**

1. Generate keys

        $ dnssec-keygen -a HMAC-SHA512 -b 512 -n HOST swarmgateway.device.lab11.eecs.umich.edu.
        $ ls
        Kswarmgateway.device.lab11.eecs.umich.edu.+165+08430.key 
        Kswarmgateway.device.lab11.eecs.umich.edu.+165+08430.private 

2. Configure DNS server

    These configurations are for BIND9.

    Set up a key file (with restrctive permissions) for bind to read from:

        $ cat /etc/bind/ddns-keys-lab11.conf 
        key "swarmgateway.device.lab11.eecs.umich.edu." {
        algorithm HMAC-SHA512;
        secret "<-- PASTE THE SECRET FROM YOUR .key FILE HERE -->";
        };

    Updated your `named` file to include a new zone:

        include "/etc/bind/ddns-keys-lab11.conf";
        zone "device.lab11.eecs.umich.edu" IN {
              type master;
              file "/var/lib/bind/db.device.lab11.eecs.umich.edu";
              update-policy {
                      grant swarmgateway.device.lab11.eecs.umich.edu. wildcard *.device.lab11.eecs.umich.edu. A AAAA TXT;
              };
              notify no;
        };

    And create a database file:

        $ cat /var/lib/bind/db.device.lab11.eecs.umich.edu
        $ORIGIN .
        $TTL 30	; 30 seconds
        device.lab11.eecs.umich.edu IN SOA eecsdns.eecs.umich.edu. helpeecs.umich.edu. (
      				2016062002 ; serial
      				120        ; refresh (2 minutes)
      				120        ; retry (2 minutes)
      				2419200    ; expire (4 weeks)
      				120        ; minimum (2 minutes)
      				)
      			NS	dns.eecs.umich.edu.
      			NS	csedns.eecs.umich.edu.
      			NS	eecsdns.eecs.umich.edu.

    Some gotcha's:
       * Whitespace is very significant throughout configurations. Vim did a good job of highlighting errors for me.
       * Use the configuration check utilities from bind to verify your work
          - `named-checkconf`
          - `named-checkzone device.lab11.eecs.umich.edu /var/lib/bind/db.device.lab11.eecs.umich.edu`
       * The bind server must be able to write to the database file AND be able to create new files in the same directory as the database file. See the next point.
       * AppArmor / SELinux will stop things from working out-of-the-box on most installs, see http://askubuntu.com/questions/172030/how-to-allow-bind-in-app-armor
          - Note you may want to change that AppArmor example to allow for any file in the directory (`/*`) or subdirectories (`/**`)

3. Set up the gateways

    On the gateway, you'll need to copy the keys (**both** the `.key` and `.private`) to `/etc/swarm-gateway/ddns/`.

    Install dependencies
  
        sudo pip3 install dnspython3
        sudo apt install dnsutils

    Install `ddns` updates as a cron job (`cp gateway/cron/ddns /etc/cron.hourly`)
    
        - FIXME: Some configuration options are hardcoded into this script currently, you'll need to update them

    You can test that everything's working with `sudo run-parts /etc/cron.hourly`

