FROM ubuntu
MAINTAINER https://github.com/lab11

ENV DEBIAN_FRONTEND noninteractive

# Install needed packages
RUN apt-get update
RUN apt-get install -y python3 python3-pip supervisor vim

# Need pip dependencies
RUN pip3 install flask
RUN pip3 install requests

# Add run file for starting everything that also configures things, like
# the SQL database
ADD redirect-server.py /redirect-server.py

# Add supervisor configurations
ADD supervisor-server.conf /etc/supervisor/conf.d/server.conf

# Specify which ports we use
EXPOSE 5000

# We want to go with the setup script when the docker image starts.
# This will call supervisor to get things going when it finishes.
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
