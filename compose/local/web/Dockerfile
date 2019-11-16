FROM python:3.6

ENV PYTHONUNBUFFERED 1

COPY ./requirements /requirements
RUN pip install -r requirements/local.txt
# TODO: may not need this anymore
# Uncommenting this line upgrades existing docker container according to
# requirements/ adjustments.  Requires docker-compose restart
#RUN pip --no-cache-dir install --upgrade -r requirements/local.txt

COPY ./compose/local/web/start /start
RUN sed -i 's/\r$//g' /start
RUN chmod +x /start

WORKDIR /code
