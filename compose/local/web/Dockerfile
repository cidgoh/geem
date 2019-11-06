FROM python:3.6

ENV PYTHONUNBUFFERED 1

# TODO: may not need this anymore
# Uncommenting this line upgrades existing docker container according to 
# requirements.txt adjustments.  Requires docker-compose restart
#RUN pip --no-cache-dir install --upgrade -r requirements.txt

COPY ./requirements.txt /requirements.txt
RUN pip install -r requirements.txt

COPY ./compose/local/web/start /start
RUN sed -i 's/\r$//g' /start
RUN chmod +x /start

WORKDIR /code
