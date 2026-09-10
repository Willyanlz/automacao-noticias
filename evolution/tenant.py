"""Local administration: python3 tenant.py create SEU_CLIENTE | status SEU_CLIENTE | verify-isolation SEU_CLIENTE"""
import json
import os
from pathlib import Path
import re
import secrets
import sys
import urllib.request
import urllib.error

os.umask(0o077)
ROOT = Path(__file__).resolve().parent
env = dict(line.split('=', 1) for line in (ROOT / '.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
BASE = os.environ.get('EVOLUTION_BASE', 'http://127.0.0.1:8080')
ADMIN = env['AUTHENTICATION_API_KEY']

def request(path, key, method='GET', data=None):
    req = urllib.request.Request(BASE + path, data=json.dumps(data).encode() if data is not None else None,
                                 headers={'apikey': key, 'Content-Type': 'application/json'}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.load(r)
    except urllib.error.HTTPError as e:
        return e.code, None

def create(name):
    folder = ROOT / 'tenants'
    folder.mkdir(mode=0o700, exist_ok=True)
    target = folder / (name + '.json')
    if target.exists():
        raise SystemExit('Tenant file already exists; no changes made.')
    token = secrets.token_hex(32)
    status, result = request('/instance/create', ADMIN, 'POST', {
        'instanceName': name, 'token': token, 'qrcode': False, 'integration': 'WHATSAPP-BAILEYS',
        'rejectCall': False, 'groupsIgnore': False, 'alwaysOnline': False,
        'readMessages': False, 'readStatus': False, 'syncFullHistory': False})
    if status not in (200, 201):
        raise SystemExit('Create failed, HTTP ' + str(status))
    with target.open('x') as f:
        json.dump({'instance': name, 'apikey': token, 'url': 'http://evolution-api:8080'}, f, indent=2)
    print('Instance created; credential saved privately in ' + str(target))

def status(name):
    token = json.loads((ROOT / 'tenants' / (name + '.json')).read_text())['apikey']
    code, body = request('/instance/connectionState/' + name, token)
    print(json.dumps({'http': code, 'connection': body}))

def verify(name):
    token = json.loads((ROOT / 'tenants' / (name + '.json')).read_text())['apikey']
    temporary = 'isolation-test-' + secrets.token_hex(6)
    other = secrets.token_hex(32)
    code, _ = request('/instance/create', ADMIN, 'POST', {'instanceName': temporary, 'token': other, 'qrcode': False, 'integration': 'WHATSAPP-BAILEYS'})
    assert code in (200, 201), ('temporary create', code)
    try:
        checks = {}
        for label, path, key, expected in [
            ('own instance', '/instance/connectionState/' + name, token, (200,)),
            ('cross instance denied', '/instance/connectionState/' + temporary, token, (401, 403)),
            ('reverse cross denied', '/instance/connectionState/' + name, other, (401, 403)),
            ('invalid key denied', '/instance/connectionState/' + name, 'invalid-test', (401, 403))]:
            code, _ = request(path, key)
            assert code in expected, (label, code)
            checks[label] = code
        code, body = request('/instance/fetchInstances', token)
        assert code == 200 and isinstance(body, list), ('list', code)
        names = [i.get('name') or i.get('instance', {}).get('instanceName') for i in body]
        assert names == [name], ('tenant list leaked', names)
        checks['list restricted to own instance'] = True
        print(json.dumps(checks))
    finally:
        code, _ = request('/instance/delete/' + temporary, ADMIN, 'DELETE')
        assert code in (200, 204), ('temporary cleanup', code)

if __name__ == '__main__':
    if len(sys.argv) != 3 or sys.argv[1] not in ('create', 'status', 'verify-isolation') or not re.fullmatch('[a-z0-9_-]+', sys.argv[2]):
        raise SystemExit(__doc__)
    {'create': create, 'status': status, 'verify-isolation': verify}[sys.argv[1]](sys.argv[2])
