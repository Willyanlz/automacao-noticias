FROM python:3.12-alpine
WORKDIR /app
RUN apk add --no-cache tzdata
COPY app.py /app/app.py
ENV HISTORICO_DB=/data/historico.sqlite HISTORICO_PORT=8090
CMD ["python", "/app/app.py"]
