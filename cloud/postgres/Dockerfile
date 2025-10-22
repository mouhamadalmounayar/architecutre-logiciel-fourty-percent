FROM postgres:16-alpine

ENV POSTGRES_DB=mydb
ENV POSTGRES_USER=admin
ENV POSTGRES_PASSWORD=admin123

COPY init/ /docker-entrypoint-initdb.d/

EXPOSE 5432
