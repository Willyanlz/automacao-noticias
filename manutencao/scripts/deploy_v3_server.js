const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const host = 'willyanlz@192.168.15.22';
const port = '1512';
const staging = path.join(os.tmpdir(), 'financas_iguera_deploy');

fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(path.join(staging, 'historico'), { recursive: true });

fs.copyFileSync('create_v3_compact.js', path.join(staging, 'create_v3_compact.js'));
fs.copyFileSync('noticias_v3.json', path.join(staging, 'noticias_v3.json'));
fs.copyFileSync(path.join('historico', 'app.py'), path.join(staging, 'historico', 'app.py'));
fs.copyFileSync(path.join('historico', 'Dockerfile'), path.join(staging, 'historico', 'Dockerfile'));

const compose = fs.readFileSync(path.join('evolution', 'docker-compose.yml'), 'utf8')
  .replace('build: ../historico', 'build: ./historico')
  .replaceAll('SEU_IP_LAN', '192.168.15.22');
fs.writeFileSync(path.join(staging, 'docker-compose.yml'), compose);

fs.writeFileSync(path.join(staging, 'merge_config.py'), `
import json, os

def first_workflow(obj):
    if isinstance(obj, list):
        return obj[0] if obj else {}
    return obj or {}

next_path = '/home/willyanlz/docker/evolution/noticias_v3.json'
cur_path = '/tmp/current_v3.json'
if os.path.exists(cur_path):
    with open(cur_path, encoding='utf-8') as f:
        current = first_workflow(json.load(f))
    with open(next_path, encoding='utf-8') as f:
        nxt = first_workflow(json.load(f))
    current_config = next((n for n in current.get('nodes', []) if n.get('name') == 'Configurar Cliente'), None)
    next_config = next((n for n in nxt.get('nodes', []) if n.get('name') == 'Configurar Cliente'), None)
    skip = {'forcarAgora', 'forcarResumao', 'forcarHistorico', 'fluxo'}
    if current_config and next_config:
        old = {a.get('name'): a for a in current_config['parameters']['assignments']['assignments']}
        for a in next_config['parameters']['assignments']['assignments']:
            name = a.get('name')
            if name in old and name not in skip:
                a['value'] = old[name].get('value')
                a['type'] = old[name].get('type', a.get('type'))
    with open(next_path, 'w', encoding='utf-8') as f:
        json.dump(nxt, f, indent=2, ensure_ascii=False)
`);

fs.writeFileSync(path.join(staging, 'inspect_after.py'), `
import json
with open('/tmp/after_v3.json', encoding='utf-8') as f:
    data = json.load(f)
w = data[0] if isinstance(data, list) else data
config = next(n for n in w['nodes'] if n['name'] == 'Configurar Cliente')['parameters']['assignments']['assignments']
print(json.dumps({
    'active': w.get('active'),
    'nodes': len(w.get('nodes', [])),
    'webhooks': [n['parameters'].get('path') for n in w['nodes'] if n.get('type') == 'n8n-nodes-base.webhook'],
    'config': [{'name': a['name'], 'value': a.get('value'), 'type': a.get('type')} for a in config if any(x in a['name'] for x in ['numero', 'forcar', 'fluxo'])],
}, indent=2, ensure_ascii=False))
`);

fs.writeFileSync(path.join(staging, 'deploy_remote.sh'), `set -euo pipefail
cd /home/willyanlz/docker/evolution
mkdir -p historico
cp /tmp/deploy_financas/create_v3_compact.js ./create_v3_compact.js
cp /tmp/deploy_financas/noticias_v3.json ./noticias_v3.json
cp /tmp/deploy_financas/docker-compose.yml ./docker-compose.yml
cp /tmp/deploy_financas/historico/app.py ./historico/app.py
cp /tmp/deploy_financas/historico/Dockerfile ./historico/Dockerfile

docker compose up -d --build historico

docker exec -u node n8n n8n export:workflow --id=noticiasV3Compacta --output=/tmp/current_v3.json >/tmp/export_v3.log 2>&1 || true
docker cp n8n:/tmp/current_v3.json /tmp/current_v3.json >/dev/null 2>&1 || true
python3 /tmp/deploy_financas/merge_config.py

docker cp ./noticias_v3.json n8n:/tmp/noticias_v3.json
docker exec -u node n8n n8n import:workflow --input=/tmp/noticias_v3.json
docker exec -u node n8n n8n update:workflow --id=noticiasV3Compacta --active=true
docker restart n8n >/dev/null
sleep 8

docker ps --format '{{.Names}} {{.Status}}' | grep -E 'noticias-integration|historico|n8n|evolution' || true
docker exec -u node n8n n8n export:workflow --id=noticiasV3Compacta --output=/tmp/after_v3.json >/tmp/export_after.log 2>&1
docker cp n8n:/tmp/after_v3.json /tmp/after_v3.json >/dev/null
python3 /tmp/deploy_financas/inspect_after.py
`);

execFileSync('ssh', ['-p', port, host, 'rm -rf /tmp/deploy_financas && mkdir -p /tmp/deploy_financas'], { stdio: 'inherit' });
execFileSync('scp', ['-P', port, '-r', `${staging}${path.sep}.`, `${host}:/tmp/deploy_financas/`], { stdio: 'inherit' });
execFileSync('ssh', ['-p', port, host, 'bash /tmp/deploy_financas/deploy_remote.sh'], { stdio: 'inherit' });
