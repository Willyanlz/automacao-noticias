import html
import json
import os
import sqlite3
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from urllib.parse import urlparse, parse_qs

DB = os.environ.get('HISTORICO_DB', '/data/historico.sqlite')
PORT = int(os.environ.get('HISTORICO_PORT', 8090))
RETENCAO_DIAS = int(os.environ.get('HISTORICO_RETENCAO_DIAS', 0))
TZ = ZoneInfo(os.environ.get('TZ', 'America/Sao_Paulo'))


def agora():
    return datetime.now(TZ)


def hoje():
    return agora().strftime('%Y-%m-%d')


def agora_ts():
    return agora().timestamp()


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
                criado_em REAL NOT NULL,
                escopo TEXT DEFAULT "default"
            );
            CREATE INDEX IF NOT EXISTS idx_envios_dia ON envios(dia);
            CREATE INDEX IF NOT EXISTS idx_envios_link ON envios(link);
        ''')
        cols = {r[1] for r in db.execute('PRAGMA table_info(envios)').fetchall()}
        for name, ddl in {
            'resumo': 'ALTER TABLE envios ADD COLUMN resumo TEXT',
            'tipo': 'ALTER TABLE envios ADD COLUMN tipo TEXT DEFAULT "noticia"',
            'message_id': 'ALTER TABLE envios ADD COLUMN message_id TEXT',
            'escopo': 'ALTER TABLE envios ADD COLUMN escopo TEXT DEFAULT "default"',
        }.items():
            if name not in cols:
                db.execute(ddl)
        db.execute('CREATE INDEX IF NOT EXISTS idx_envios_escopo_dia ON envios(escopo, dia)')
        db.execute('CREATE INDEX IF NOT EXISTS idx_envios_escopo_link ON envios(escopo, link)')
        if RETENCAO_DIAS > 0:
            limite = (agora() - timedelta(days=RETENCAO_DIAS)).timestamp()
            db.execute('DELETE FROM envios WHERE criado_em < ?', (limite,))


def registrar(dados):
    escopo = str(dados.get('escopo') or dados.get('cliente') or 'default').strip() or 'default'
    link = str(dados.get('link') or '').strip()
    titulo = str(dados.get('titulo') or '').strip()
    resumo = str(dados.get('resumo') or '').strip()
    tipo = str(dados.get('tipo') or 'noticia').strip() or 'noticia'
    dia = str(dados.get('dia') or hoje())[:10]
    job_id = str(dados.get('jobId') or '')
    message_id = str(dados.get('messageId') or '')
    if not link and tipo != 'resumao':
        return {'erro': 'link obrigatorio'}
    chave = link or f'resumao:{dia}:{message_id or job_id or agora_ts()}'
    id_registro = hashlib.sha256(f'{escopo}:{dia}:{chave}'.encode()).hexdigest()[:16]
    with sqlite3.connect(DB) as db:
        db.execute('''
            INSERT INTO envios (id, link, titulo, dia, job_id, criado_em, resumo, tipo, message_id, escopo)
            VALUES (?,?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET
                titulo=excluded.titulo,
                resumo=excluded.resumo,
                tipo=excluded.tipo,
                message_id=excluded.message_id,
                job_id=excluded.job_id,
                escopo=excluded.escopo
        ''', (id_registro, link, titulo, dia, job_id, agora_ts(), resumo, tipo, message_id, escopo))
    return {'registrado': True, 'id': id_registro}


def listar_dia(data, escopo='default'):
    with sqlite3.connect(DB) as db:
        rows = db.execute('''
            SELECT link, titulo, job_id, criado_em, resumo, tipo, message_id, escopo
            FROM envios WHERE dia=? AND escopo=? ORDER BY criado_em
        ''', (data, escopo)).fetchall()
    return [
        {
            'link': r[0],
            'titulo': r[1] or '',
            'jobId': r[2] or '',
            'hora': datetime.fromtimestamp(r[3], TZ).strftime('%H:%M:%S'),
            'criadoEm': datetime.fromtimestamp(r[3], TZ).isoformat(),
            'resumo': r[4] or '',
            'tipo': r[5] or 'noticia',
            'messageId': r[6] or '',
            'escopo': r[7] or 'default',
        }
        for r in rows
    ]


def verificar(links, escopo='default'):
    if not links:
        return []
    links_limpos = [str(link or '').strip() for link in links]
    links_limpos = [link for link in links_limpos if link]
    if not links_limpos:
        return []
    placeholders = ','.join('?' * len(links_limpos))
    with sqlite3.connect(DB) as db:
        enviados = set(r[0] for r in db.execute(
            f'SELECT DISTINCT link FROM envios WHERE escopo=? AND link IN ({placeholders})',
            (escopo, *links_limpos)
        ).fetchall())
    return [link for link in links_limpos if link not in enviados]


def pagina_dia(data, escopo='default'):
    rows = listar_dia(data, escopo)
    cards = []
    for r in rows:
        title = html.escape(r['titulo'] or '(sem titulo)')
        resumo = html.escape(r['resumo'] or '').replace('\n', '<br>')
        link = html.escape(r['link'] or '')
        tipo = html.escape(r['tipo'])
        hora = html.escape(r['hora'])
        url = f'<a href="{link}" target="_blank" rel="noopener">abrir fonte</a>' if link else ''
        cards.append(f'''
        <article class="card">
          <div class="meta"><span>{hora}</span><span>{tipo}</span></div>
          <h2>{title}</h2>
          <p>{resumo}</p>
          {url}
        </article>''')
    corpo = '\n'.join(cards) or '<p class="empty">Nenhuma notícia registrada neste dia.</p>'
    return f'''<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Histórico de notícias - {html.escape(data)}</title>
<style>
body{{font-family:Arial,sans-serif;background:#f6f7f9;color:#16202a;margin:0;padding:24px}}.wrap{{max-width:900px;margin:auto}}h1{{margin:0 0 8px}}.sub{{color:#667085;margin-bottom:24px}}.card{{background:white;border:1px solid #e5e7eb;border-radius:14px;padding:18px;margin:14px 0;box-shadow:0 1px 2px #0001}}.meta{{display:flex;gap:10px;color:#667085;font-size:13px;text-transform:uppercase}}h2{{font-size:20px;margin:10px 0}}p{{line-height:1.5}}a{{color:#0b65c2}}.empty{{background:white;padding:18px;border-radius:12px}}</style>
</head><body><main class="wrap"><h1>Histórico de notícias</h1><div class="sub">Dia {html.escape(data)} · {len(rows)} registro(s)</div>{corpo}</main></body></html>'''


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        try:
            dados = json.loads(self.rfile.read(length)) if length else {}
        except Exception:
            return self.responder({'erro': 'JSON invalido'}, 400)
        if self.path == '/registrar':
            self.responder(registrar(dados))
        elif self.path == '/verifica':
            self.responder({'links': verificar(dados.get('links', []), str(dados.get('escopo') or dados.get('cliente') or 'default'))})
        else:
            self.responder({'erro': 'Endpoint invalido'}, 404)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        escopo = (query.get('escopo') or ['default'])[0] or 'default'
        if path == '/health':
            return self.responder({'status': 'ok'})
        if path == '/hoje':
            return self.responder_html(pagina_dia(hoje(), escopo))
        if path.startswith('/dia/'):
            rest = path.split('/dia/', 1)[1].strip('/')
            parts = rest.split('/')
            data = parts[0]
            if len(parts) > 1 and parts[1] == 'html':
                return self.responder_html(pagina_dia(data, escopo))
            return self.responder(listar_dia(data, escopo))
        self.responder({'erro': 'Endpoint invalido'}, 404)

    def responder(self, dados, status=200):
        body = json.dumps(dados, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def responder_html(self, html_text, status=200):
        body = html_text.encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    init_db()
    print(f'Historico rodando na porta {PORT}')
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()