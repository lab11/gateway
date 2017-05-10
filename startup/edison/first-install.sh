#!/bin/sh
# This script runs on first boot after an edison has been flashed.
# When it finishes, it comments itself out so it doesn't run again.

# EDISON ONLY

# Exit first-install by commenting out this script and rebooting
exit_install () {
    # Comment out first-install.sh from /etc/rc.local
    sed -i -E "s/^(.*)(first-install\.sh)(.*)$/#\1\2\3/g" /etc/rc.local
    echo "Rebooting...."
    reboot
}

# continue normal flow or exit on error code
# arg $1 : return code to check
# arg $2 : string resuming the action
fi_assert () {
    if [ $1 -ne 0 ]; then
        echo "${2} : Failed ret($1)" >&2;
        #exit_first_install $1;
    else
        echo "${2} : Success";
    fi
}

# generate sshd keys
sshd_init () {
    rm -rf /etc/ssh/*key*
    ssh-keygen -A
}

# Substitute the SSID and passphrase in the file /etc/hostapd/hostapd.conf
# The SSID is built from the hostname and a serial number to have a
# unique SSID in case of multiple Edison boards having their WLAN AP active.
setup_ap_ssid_and_passphrase () {
    # factory_serial is 16 bytes long
    if [ -f /sys/class/net/wlan0/address ];
    then
        ifconfig wlan0 up
        wlan0_addr=$(cat /sys/class/net/wlan0/address)
        ssid="EDISON-${wlan0_addr}"

        # Substitute the SSID
        sed -i -e 's/^ssid=.*/ssid='${ssid}'/g' /etc/hostapd/hostapd.conf
    fi

    mkdir -p /factory
    mount /dev/mmcblk0p5 /factory
    if [ -f /factory/serial_number ] ;
    then
        factory_serial=$(head -n1 /factory/serial_number | tr '[:lower:]' '[:upper:]')
        passphrase="${factory_serial}"

        # Substitute the passphrase
        sed -i -e 's/^wpa_passphrase=.*/wpa_passphrase='${passphrase}'/g' /etc/hostapd/hostapd.conf
    fi
    umount /factory

    sync
}

# Format update partition
mkfs.vfat /dev/mmcblk0p9 -n "Edison" -F 32
fi_assert $? "Formatting update partition"

# Get the gateway ID
/home/debian/gateway/startup/edison/set_gateway_id.sh
fi_assert $? "Setting gateway ID"

# ssh
sshd_init
fi_assert $? "Generating sshd keys"

# Setup Access Point SSID and passphrase.
# We don't really use this now, but in case we want to in the future it
# doesn't really hurt.
setup_ap_ssid_and_passphrase
fi_assert $? "Generating Wifi Access Point SSID and passphrase"

# Create an SSH key for debian user
runuser -l debian -c 'ssh-keygen -f /home/debian/.ssh/id_rsa -q -N ""'
echo "Gateway SSH public key"
cat /home/debian/.ssh/id_rsa.pub

# I guess do this? Don't really know why.
depmod -a

echo "First install Done"

exit_install
