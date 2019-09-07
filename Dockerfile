FROM python:3.6

ENV PYTHONUNBUFFERED 1

COPY . /code/
WORKDIR /code/

# Uncommenting this line upgrades existing docker container according to 
# requirements.txt adjustments.  Requires docker-compose restart
#RUN pip --no-cache-dir install --upgrade -r requirements.txt

RUN pip install -r requirements.txt

EXPOSE 8000
