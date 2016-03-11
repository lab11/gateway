Gateway Watchdog Emailer
========================

Monitor the gateway and send an email notification if an error occurs.

Configuration
-------------

Requires the email addresses to send the notification to and the address and
credentials for an SMTP server in
[nodemailer's](https://github.com/nodemailer/nodemailer) expected format. To do
this, create `/etc/swarm-gateway/email.conf` and add:

    to_list = <comma-separated list of recipient email addresses>
    email_transport = <transport string>

Example

    # /etc/swarm-gateway/email.conf
    to_list = person1@test.com,person2@test.com
    email_transport = smtps://user%40gmail.com:pass@smtp.gmail.com

