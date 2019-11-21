FROM python:3.6

ENV PYTHONUNBUFFERED 1

# https://docs.docker.com/develop/develop-images/dockerfile_best-practices/#user
RUN addgroup --system non_root_group \
    && adduser --system non_root_user \
    && adduser non_root_user non_root_group

COPY ./requirements /requirements
RUN pip install -r requirements/production.txt && rm -rf /requirements

COPY ./compose/production/web/start /start
RUN sed -i 's/\r$//g' /start
RUN chmod +x /start
RUN chown non_root_user /start

COPY . /code
RUN chown -R non_root_user /code

USER non_root_user

WORKDIR /code
