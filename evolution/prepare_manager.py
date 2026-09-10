"""Extrai o Manager da imagem e usa o logo que já acompanha o container."""
from pathlib import Path
import os
import subprocess
import sys

root = Path(__file__).resolve().parent
target = root / 'manager'
if target.exists():
    raise SystemExit('A pasta manager já existe. Preserve-a antes de preparar outra versão.')
container = subprocess.check_output(
    ['docker', 'create', 'evoapicloud/evolution-api:v2.3.7'], text=True
).strip()
try:
    target.mkdir()
    subprocess.run(['docker', 'cp', container + ':/evolution/manager/dist/.', str(target)], check=True)
finally:
    subprocess.run(['docker', 'rm', container], check=True)

assert (target / 'assets/images/evolution-logo.png').is_file()
for path in [target / 'index.html', *target.glob('assets/*.js')]:
    content = path.read_text(encoding='utf-8')
    for name in ['evolution-logo.svg', 'evolution-logo-white.svg', 'favicon.svg']:
        content = content.replace('https://evolution-api.com/files/evo/' + name,
                                  '/assets/images/evolution-logo.png')
    if path.name == 'index.html':
        content = content.replace('.js"', '.js?v=local-logo-1"')
    path.write_text(content, encoding='utf-8')
for directory, _, files in os.walk(target):
    os.chmod(directory, 0o755)
    for name in files:
        os.chmod(Path(directory) / name, 0o644)
subprocess.run([sys.executable, str(root / 'patch_manager_chat.py'), str(target)], check=True)
print('Manager preparado. Aplique com docker compose up -d api.')
