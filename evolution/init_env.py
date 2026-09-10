"""Run on the server, inside the stack folder. Never prints secrets."""
from pathlib import Path
import os
import secrets

os.umask(0o077)
password = secrets.token_hex(32)
key = secrets.token_hex(32)
with Path('.env').open('x') as f:
    f.write(f'''SERVER_TYPE=http
SERVER_PORT=8080
SERVER_URL=https://SEU_DOMINIO_PUBLICO
AUTHENTICATION_API_KEY={key}
AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=false
POSTGRES_PASSWORD={password}
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://evolution:{password}@postgres:5432/evolution?schema=public
DATABASE_CONNECTION_CLIENT_NAME=evolution
DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=true
DATABASE_SAVE_MESSAGE_UPDATE=true
DATABASE_SAVE_DATA_CONTACTS=true
DATABASE_SAVE_DATA_CHATS=true
DATABASE_SAVE_DATA_LABELS=true
DATABASE_SAVE_DATA_HISTORIC=true
CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://redis:6379/0
CACHE_REDIS_PREFIX_KEY=evolution
CACHE_REDIS_SAVE_INSTANCES=false
CACHE_LOCAL_ENABLED=false
DEL_INSTANCE=false
CONFIG_SESSION_PHONE_CLIENT=Evolution
CONFIG_SESSION_PHONE_NAME=Chrome
LOG_LEVEL=ERROR,WARN,LOG
LOG_BAILEYS=error
TELEMETRY_ENABLED=false
SENTRY_DSN=
CORS_ORIGIN=*
CORS_CREDENTIALS=false
WEBHOOK_GLOBAL_ENABLED=false
RABBITMQ_ENABLED=false
SQS_ENABLED=false
WEBSOCKET_ENABLED=false
CHATWOOT_ENABLED=false
TYPEBOT_ENABLED=false
S3_ENABLED=false
LANGUAGE=pt-BR
NODE_OPTIONS=--max-old-space-size=512
''')
print('Created .env with mode 600; secrets remain on server.')
