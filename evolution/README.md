# Stack Evolution + Historico

Stack Docker usada pelo workflow `noticias_v3.json`.

## Servicos

- `api`: Evolution API `evoapicloud/evolution-api:v2.3.7`.
- `historico`: servico SQLite minimo em `../historico`, porta interna `8090`.
- `postgres`: banco da Evolution.
- `redis`: cache/fila da Evolution.

## Subir local/servidor

```bash
cd evolution
docker compose up -d --build
```

O n8n deve estar na rede Docker externa `n8n_default`, porque o workflow usa:

- `http://evolution-api:8080`
- `http://historico:8090`

## Clientes

Use `tenant.py` para criar/verificar instancias da Evolution:

```bash
python3 tenant.py create iguera
python3 tenant.py status iguera
python3 tenant.py verify-isolation iguera
```

Credenciais e tokens reais ficam somente no servidor (`.env` e `tenants/`) e nao entram no Git.
