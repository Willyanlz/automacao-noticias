"""Histórico transacional de notícias. Não acessa Gemini nem envia WhatsApp."""
import hashlib
import hmac
import json
import os
import re
import sqlite3
import time
import unicodedata
import uuid
from contextlib import contextmanager, closing
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
from zoneinfo import ZoneInfo

DB = os.environ.get('NEWS_DB', '/data/noticias.sqlite')
KEY = os.environ.get('NEWS_STATE_KEY', '')
TZ = ZoneInfo('America/Sao_Paulo')


def canonical(url):
    p = urlsplit(str(url).strip())
    if p.scheme not in ('http', 'https') or not p.hostname:
        raise ValueError('URL de notícia inválida.')
    query = [(k, v) for k, v in parse_qsl(p.query) if not k.lower().startswith('utm_') and k.lower() not in ('fbclid', 'gclid')]
    return urlunsplit(('https', p.netloc.lower().removeprefix('www.'), p.path.rstrip('/') or '/', urlencode(sorted(query)), ''))


def title_key(title):
    return re.sub(r'[^a-z0-9]+', ' ', unicodedata.normalize('NFKD', str(title)).encode('ascii', 'ignore').decode().lower()).strip()


def context(config):
    number = str(config.get('numero', '')).strip()
    if '@' not in number:
        number = re.sub(r'\D', '', number)
    if not re.fullmatch(r'(?:\d{10,15}|[\d-]+@g\.us)', number):
        raise ValueError('Preencha numero com telefone completo ou ID do grupo.')
    instance = str(config.get('instancia', '')).strip()
    base = str(config.get('evolutionUrl', '')).strip().rstrip('/')
    if not instance or not base:
        raise ValueError('Preencha instancia e evolutionUrl.')
    return hashlib.sha256(json.dumps([base, instance, number]).encode()).hexdigest()


def minute(value):
    if not re.fullmatch(r'\d{2}:\d{2}', str(value)):
        raise ValueError('Horários devem usar HH:MM.')
    h, m = map(int, value.split(':'))
    if h > 23 or m > 59:
        raise ValueError('Horário inválido.')
    return h * 60 + m


def schedule(c):
    start, end, digest = (minute(c.get(k, v)) for k, v in [('inicioEnvios', '08:00'), ('fimEnvios', '18:00'), ('horarioResumao', '19:00')])
    if not start <= end or not start < digest:
        raise ValueError('Use início <= fim dos envios e resumão depois do início, no mesmo dia.')
    mode = c.get('periodicidade', 'intervalo')
    interval = int(c.get('intervaloMinutos', 60))
    if mode not in ('intervalo', 'diario') or not 5 <= interval <= 1440:
        raise ValueError('periodicidade: intervalo ou diario; intervaloMinutos: 5 a 1440.')
    daily = minute(c.get('horarioEnvioDiario', '08:00'))
    if mode == 'diario' and not start <= daily <= min(end, digest - 1):
        raise ValueError('O horário diário deve estar dentro da janela de envios.')
    return start, end, digest, mode, interval, daily


def initialize():
    os.makedirs(os.path.dirname(DB) or '.', exist_ok=True)
    with closing(sqlite3.connect(DB)) as db:
        db.executescript('''
        PRAGMA journal_mode=WAL;
        CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, scope TEXT NOT NULL, kind TEXT NOT NULL,
          day TEXT NOT NULL, slot TEXT NOT NULL, status TEXT NOT NULL, owner TEXT, config TEXT NOT NULL,
          created REAL NOT NULL, touched REAL NOT NULL, payload TEXT, UNIQUE(scope,kind,slot));
        CREATE TABLE IF NOT EXISTS deliveries(id TEXT PRIMARY KEY, scope TEXT NOT NULL, kind TEXT NOT NULL,
          job TEXT, status TEXT NOT NULL, created REAL NOT NULL, sent REAL, day TEXT, message_id TEXT,
          article TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS article_keys(scope TEXT NOT NULL, key TEXT NOT NULL,
          delivery TEXT NOT NULL, PRIMARY KEY(scope,key));
        CREATE INDEX IF NOT EXISTS delivery_scope_day ON deliveries(scope,day,status,kind);
        CREATE TABLE IF NOT EXISTS settings(scope TEXT PRIMARY KEY, first_seen REAL NOT NULL);
        ''')


@contextmanager
def transaction():
    db = sqlite3.connect(DB, timeout=30)
    db.row_factory = sqlite3.Row
    db.execute('BEGIN IMMEDIATE')
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def keys(article):
    urls = article.get('links') or [article['link']]
    return list(dict.fromkeys(['url:' + canonical(url) for url in urls] + ['title:' + title_key(article.get('tituloOriginal') or article['titulo'])]))


def seen(db, scope, article):
    return any(db.execute('SELECT 1 FROM article_keys WHERE scope=? AND key=?', (scope, key)).fetchone() for key in keys(article))


def active_job(db, job_id, now, kind=None):
    job = db.execute('SELECT * FROM jobs WHERE id=?', (job_id,)).fetchone()
    if not job or job['status'] != 'active' or (kind and job['kind'] != kind):
        return None
    local = datetime.fromtimestamp(now, TZ)
    if (job['kind'] == 'noticias' and job['day'] != local.date().isoformat()) or now - job['touched'] > 1200:
        return None
    # Slots manuais (fora de horário) não estão sujeitos à janela de envio.
    if job['kind'] == 'noticias' and not job['slot'].startswith('manual:'):
        c = json.loads(job['config'])
        _, end, digest, *_ = schedule(c)
        if local.hour * 60 + local.minute >= min(end + 1, digest):
            return None
    return job


def recent(db, scope):
    rows = db.execute("SELECT article FROM deliveries WHERE scope=? AND status='sent' AND kind='noticia' ORDER BY sent DESC LIMIT 100", (scope,)).fetchall()
    return [{k: json.loads(row['article']).get(k) for k in ('titulo', 'link', 'resumo')} for row in rows]


def dispatch(path, data, now=None):
    now = time.time() if now is None else now
    local = datetime.fromtimestamp(now, TZ)
    day = local.date().isoformat()
    minutes = local.hour * 60 + local.minute
    with transaction() as db:
        if path == '/tick':
            c = data['config']
            scope = context(c)
            start, end, digest, mode, interval, daily = schedule(c)
            # Modo manual forçado: executa a qualquer hora e realmente envia (ignora janela/horário).
            if data.get('manual') and c.get('enviar') is True:
                kind = 'noticias'
                owner = str(data.get('executionId') or uuid.uuid4())
                slot = 'manual:' + day + ':' + owner + ':' + str(uuid.uuid4())
                job_id = str(uuid.uuid4())
                db.execute('INSERT INTO jobs VALUES(?,?,?,?,?,?,?,?,?,?,?)', (job_id, scope, kind, day, slot, 'active', owner, json.dumps(c), now, now, '[]'))
                return {'acao': kind, 'jobId': job_id, 'config': c, 'dia': day, 'noticias': [], 'previa': False}
            if c.get('enviar') is not True:
                return {'acao': 'noticias' if data.get('manual') else 'nada', 'previa': True, 'jobId': '', 'config': c}
            db.execute("UPDATE jobs SET status='expired' WHERE scope=? AND status='active' AND (touched<? OR (kind='noticias' AND day<>?))", (scope, now-1200, day))
            if minutes >= digest and c.get('resumaoAtivo', True):
                kind, slot = 'resumao', day
                # Aguarda confirmações de envios que estavam em voo na virada do horário.
                if db.execute("SELECT 1 FROM deliveries WHERE scope=? AND status='reserved' AND created>?", (scope, now-120)).fetchone():
                    return {'acao': 'nada', 'motivo': 'Aguardando confirmação dos últimos envios.'}
                rows = db.execute("SELECT id,article FROM deliveries WHERE scope=? AND kind='noticia' AND status='sent' AND day=? ORDER BY sent,id", (scope, day)).fetchall()
                articles = [{**json.loads(r['article']), 'registroId': r['id']} for r in rows]
                if not articles:
                    return {'acao': 'nada', 'motivo': 'Nenhuma notícia enviada hoje.'}
            elif start <= minutes <= end and minutes < digest and (mode != 'diario' or minutes >= daily):
                kind = 'noticias'
                slot_minute = daily if mode == 'diario' else start + ((minutes-start)//interval)*interval
                slot = day + ':' + str(slot_minute)
                articles = []
                # A primeira instalação aguarda a próxima marca, sem recuperar um horário antigo.
                first = db.execute('SELECT first_seen FROM settings WHERE scope=?', (scope,)).fetchone()
                if not first:
                    db.execute('INSERT INTO settings VALUES(?,?)', (scope, now))
                    if minutes != slot_minute:
                        db.execute('INSERT OR IGNORE INTO jobs VALUES(?,?,?,?,?,?,?,?,?,?,?)', (str(uuid.uuid4()), scope, kind, day, slot, 'skipped', '', json.dumps(c), now, now, None))
                        return {'acao': 'nada', 'motivo': 'Agenda iniciada; aguardando próximo horário.'}
                running = db.execute("SELECT * FROM jobs WHERE scope=? AND kind='noticias' AND status='active'", (scope,)).fetchone()
                if running and not (running['slot'] == slot and running['owner'] == str(data.get('executionId',''))):
                    return {'acao': 'nada', 'motivo': 'Outra coleta ainda está em andamento.'}
            else:
                return {'acao': 'nada', 'motivo': 'Fora do horário configurado.'}
            previous = db.execute('SELECT * FROM jobs WHERE scope=? AND kind=? AND slot=?', (scope, kind, slot)).fetchone()
            if previous:
                if previous['status'] == 'active' and previous['owner'] == str(data.get('executionId','')):
                    return {'acao': kind, 'jobId': previous['id'], 'config': c, 'dia': day, 'noticias': json.loads(previous['payload']), 'previa': False}
                if previous['status'] not in ('expired',):
                    return {'acao': 'nada', 'motivo': 'Horário já processado ou em andamento.'}
                # Uma execução expirada pode recomeçar; reservas individuais continuam bloqueadas.
                db.execute('DELETE FROM jobs WHERE id=?', (previous['id'],))
            job_id = str(uuid.uuid4())
            db.execute('INSERT INTO jobs VALUES(?,?,?,?,?,?,?,?,?,?,?)', (job_id, scope, kind, day, slot, 'active', str(data.get('executionId','')), json.dumps(c), now, now, json.dumps(articles)))
            return {'acao': kind, 'jobId': job_id, 'config': c, 'dia': day, 'noticias': articles, 'previa': False}

        if path == '/touch':
            if not data.get('jobId'):
                return {'continuar': True}
            job = active_job(db, data['jobId'], now)
            if not job:
                return {'continuar': False}
            db.execute('UPDATE jobs SET touched=? WHERE id=?', (now, job['id']))
            return {'continuar': True}

        if path == '/filter':
            c = data['config']
            scope = context(c)
            job_id = data.get('jobId') or ''
            if job_id and not active_job(db, job_id, now, 'noticias'):
                return {'noticias': [], 'recentes': []}
            result = []
            for article in data.get('noticias', []):
                if not seen(db, scope, article):
                    result.append(article)
            return {'noticias': result[:max(1, min(50, int(c.get('maxNoticias',10))))], 'recentes': recent(db, scope)}

        if path == '/reserve':
            job_id = data.get('jobId') or ''
            if not job_id:
                # Sem job ativo (ex.: execução manual fora do horário). Nada a enviar:
                # resposta limpa em vez de erro para não quebrar a execução.
                return {'enviar': False, 'motivo': 'Sem job ativo. Nada a enviar.'}
            job = active_job(db, job_id, now)
            if not job:
                return {'enviar': False, 'motivo': 'Execução expirada ou encerrada.'}
            article = data['artigo']
            kind = 'resumao' if job['kind'] == 'resumao' else 'noticia'
            if kind == 'noticia' and seen(db, job['scope'], article):
                return {'enviar': False, 'motivo': 'Notícia já enviada ou com envio pendente.'}
            if kind == 'resumao' and db.execute("SELECT 1 FROM deliveries WHERE scope=? AND kind='resumao' AND day=?", (job['scope'], job['day'])).fetchone():
                return {'enviar': False, 'motivo': 'Resumão já enviado ou com envio pendente.'}
            record = str(uuid.uuid4())
            db.execute('INSERT INTO deliveries VALUES(?,?,?,?,?,?,?,?,?,?)', (record, job['scope'], kind, job['id'], 'reserved', now, None, job['day'], None, json.dumps(article)))
            if kind == 'noticia':
                for key in keys(article):
                    db.execute('INSERT INTO article_keys VALUES(?,?,?)', (job['scope'], key, record))
            db.execute('UPDATE jobs SET touched=? WHERE id=?', (now, job['id']))
            return {'enviar': True, 'registroId': record, 'artigo': article}

        if path == '/confirm':
            record = db.execute('SELECT * FROM deliveries WHERE id=? AND job=?', (data.get('registroId') or '', data.get('jobId') or '')).fetchone()
            if not record:
                raise ValueError('Registro de envio não encontrado. Confira registroId/jobId.')
            message_id = data.get('messageId')
            if not isinstance(message_id, str) or not message_id:
                raise ValueError('A Evolution não retornou um identificador de mensagem.')
            if record['status'] == 'sent':
                if record['message_id'] != message_id:
                    raise ValueError('Confirmação diferente da registrada.')
                return {'registrado': True}
            db.execute("UPDATE deliveries SET status='sent',sent=?,day=?,message_id=? WHERE id=?", (now, record['day'] if record['kind']=='resumao' else day, message_id, record['id']))
            db.execute('UPDATE jobs SET touched=? WHERE id=?', (now, record['job']))
            return {'registrado': True}

        if path == '/finish':
            if data.get('jobId'):
                db.execute("UPDATE jobs SET status='done',touched=? WHERE id=? AND status='active'", (now, data['jobId']))
            return {'concluido': True}

        if path == '/seed':
            scope = context(data['config'])
            count = 0
            for entry in data.get('entries', []):
                a = entry['artigo']
                sent = float(entry['sent'])
                sent_day = datetime.fromtimestamp(sent, TZ).date().isoformat()
                same_day = db.execute("SELECT article FROM deliveries WHERE scope=? AND kind='noticia' AND day=?", (scope, sent_day)).fetchall()
                entry_keys = set(keys(a))
                if any(entry_keys.intersection(keys(json.loads(row['article']))) for row in same_day):
                    continue
                record = str(uuid.uuid4())
                db.execute('INSERT INTO deliveries VALUES(?,?,?,?,?,?,?,?,?,?)', (record, scope, 'noticia', 'migration', 'sent', sent, sent, sent_day, entry['messageId'], json.dumps(a)))
                for key in keys(a):
                    db.execute('INSERT OR IGNORE INTO article_keys VALUES(?,?,?)', (scope, key, record))
                count += 1
            return {'importados': count}
        if path == '/status':
            scope = context(data['config'])
            rows = db.execute('SELECT kind,status,count(*) total FROM deliveries WHERE scope=? GROUP BY kind,status', (scope,)).fetchall()
            return {'contagens': [dict(row) for row in rows]}
        raise ValueError('Operação desconhecida.')


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def do_GET(self):
        if self.path == '/health':
            self.reply(200, {'status': 'ok'})
        else:
            self.reply(404, {'error': 'Não encontrado'})

    def reply(self, status, value):
        body = json.dumps(value, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if not KEY or not hmac.compare_digest(self.headers.get('apikey',''), KEY):
            self.reply(401, {'error': 'Unauthorized'})
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if not 0 < length <= 8_000_000:
                raise ValueError('Tamanho da requisição inválido.')
            data = json.loads(self.rfile.read(length))
            result = dispatch(self.path, data)
            self.reply(200, result)
        except (ValueError, KeyError, TypeError) as exc:
            self.reply(400, {'error': str(exc)})
        except Exception:
            self.reply(500, {'error': 'Falha no histórico. Envio interrompido.'})


if __name__ == '__main__':
    if not KEY:
        raise SystemExit('NEWS_STATE_KEY obrigatório')
    initialize()
    ThreadingHTTPServer(('0.0.0.0', 8090), Handler).serve_forever()
