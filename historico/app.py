"""Histórico mínimo de notícias. Apenas registra e consulta."""
import sqlite3
import json
import os
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from datetime import datetime, timedelta

DB = os.environ.get('HISTORICO_DB', '/data/historico.sqlite')
PORT = int(os.environ.get('HISTORICO_PORT', 8090))


def init_db():
    os.makedirs(os.path.dirname(DB) or '.', exist_ok=True)
    with sqlite3.connect(DB) as db:
        db.executescript('''
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS envios (
                id TEXT PRIMARY KEY,
                link TEXT NOT NULL,
                titulo TEXT,
                dia TEXT NOT NULL,
                job_id TEXT,
                criado_em REAL NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_envios_dia ON envios(dia);
            CREATE INDEX IF NOT EXISTS idx_envios_link ON envios(link);
        ''')
        # Limpar dados com mais de 30 dias
        limite = (datetime.now() - timedelta(days=30)).timestamp()
        db.execute('DELETE FROM envios WHERE criado_em < ?', (limite,))


def registrar(dados):
    link = dados.get('link', '')
    if not link:
        return {'erro': 'link obrigatorio'}
    dia = dados.get('dia', datetime.now().strftime('%Y-%m-%d'))
    titulo = dados.get('titulo', '')
    job_id = dados.get('jobId', '')
    id_registro = hashlib.sha256(f"{dia}:{link}".encode()).hexdigest()[:16]
    try:
        with sqlite3.connect(DB) as db:
            db.execute(
                'INSERT OR IGNORE INTO envios VALUES (?,?,?,?,?,?)',
                (id_registro, link, titulo, dia, job_id, datetime.now().timestamp())
            )
        return {'registrado': True, 'id': id_registro}
    except Exception as e:
        return {'erro': str(e)}


def listar_dia(data):
    with sqlite3.connect(DB) as db:
        rows = db.execute(
            'SELECT link, titulo, job_id FROM envios WHERE dia=? ORDER BY criado_em',
            (data,)
        ).fetchall()
    return [{'link': r[0], 'titulo': r[1], 'jobId': r[2]} for r in rows]


def verificar(links):
    """Retorna links que NAO foram enviados hoje (para deduplicacao)."""
    if not links:
        return []
    dia = datetime.now().strftime('%Y-%m-%d')
    placeholders = ','.join('?' * len(links))
    with sqlite3.connect(DB) as db:
        enviados = set(
            r[0] for r in db.execute(
                f'SELECT link FROM envios WHERE dia=? AND link IN ({placeholders})',
                (dia, *links)
            ).fetchall()
        )
    return [l for l in links if l not in enviados]


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        dados = json.loads(self.rfile.read(length)) if length else {}

        if self.path == '/registrar':
            self.responder(registrar(dados))
        elif self.path == '/verifica':
            self.responder({'links': verificar(dados.get('links', []))})
        else:
            self.responder({'erro': 'Endpoint invalido'}, 404)

    def do_GET(self):
        if self.path.startswith('/dia/'):
            data = self.path.split('/dia/')[1]
            self.responder(listar_dia(data))
        elif self.path == '/health':
            self.responder({'status': 'ok'})
        else:
            self.responder({'erro': 'Endpoint invalido'}, 404)

    def responder(self, dados, status=200):
        body = json.dumps(dados, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    init_db()
    print(f'Historico rodando na porta {PORT}')
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
