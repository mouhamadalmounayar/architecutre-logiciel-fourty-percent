FROM postgres:16-alpine

RUN apk add --no-cache bash tzdata

ENV LANG=en_US.UTF-8 \
    LANGUAGE=en_US:en \
    LC_ALL=en_US.UTF-8 \
    TZ=Etc/UTC

COPY init/ /docker-entrypoint-initdb.d/

EXPOSE 5432
