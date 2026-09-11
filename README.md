# Notícias para WhatsApp — n8n + Evolution + Gemini (v2)

Automação de notícias de investimentos para WhatsApp: coleta RSS de fontes
financeiras brasileiras, filtra por palavras-chave, busca a matéria, gera
texto didático com Gemini e envia pelo WhatsApp (Evolution API).

**Versão 2**: simplificada de 56 para 24 nós, sem microsserviço externo complexo.

## Como funciona

1. **Coleta**: RSS de InfoMoney, Money Times, Brazil Journal e Veja Economia.
2. **Filtro de palavras-chave**: filtro editorial com 38 termos relevantes para investidores.
3. **Seleção com Gemini**: prioriza notícias com potencial de impacto em mercados.
4. **Envio programado**: `periodicidade` (intervalo/diário), `intervaloMinutos`,
   `inicioEnvios`/`fimEnvios` e `horarioEnvioDiario` configuráveis.
5. **Resumão do dia**: no `horarioResumao`, uma única mensagem com TODAS as notícias
   confirmadas como enviadas naquele dia.
6. **Histórico persistente** (`historico/`): serviço mínimo com 3 endpoints
   (registrar, verificar, listar) — evita repetição e alimenta o resumão.

## Modos de execução

### Automático (agendado)
- Roda a cada minuto
- Respeita `inicioEnvios`/`fimEnvios`
- Deduplica notícias já enviadas
- Respeita `intervaloMinutos` entre envios

### Manual (Free Run) — **SEM TRAVAS**
- Clique em "Execute Workflow" para rodar imediatamente
- Sem verificação de horário
- Sem bloqueio de duplicidade (mas registra no histórico)
- Ideal para testes e envios urgentes

## Configuração no n8n

1. Importe `noticias_v2.json`. O workflow importa **inativo**.
2. No card **Configurar Cliente**, ajuste:
   - `cliente`, `instancia`, `numero`, `evolutionUrl`, `modeloGemini`, `geminiApiKey`
   - `periodicidade` (intervalo/diário), `intervaloMinutos`, `inicioEnvios`, `fimEnvios`
   - `horarioResumao`, `horarioEnvioDiario`, `maxNoticias`, `enviarLinksFontes`
3. Crie a credencial **Header Auth** da Evolution (Name `apikey`, Value do token).
4. `enviar=false` apenas revisa; `enviar=true` envia. Publique após configurar.

## Docker (Evolution + Histórico)

```bash
cd evolution
docker compose up -d
```

O serviço `historico` (porta interna 8090) substitui o antigo `noticias-estado`.
Volume persistente: `historico_data:/data`.

## Organização

| Local | Finalidade |
| --- | --- |
| `noticias_v2.json` | Workflow principal v2 (24 nós) para importar/compartilhar. |
| `consultar_ids_v2.json` | Helper separado para consultar IDs WhatsApp. |
| `historico/` | Serviço mínimo de histórico (3 endpoints, SQLite). |
| `evolution/` | Docker da Evolution API + histórico. |

> Este repositório é **público**: não inclua tokens, chaves, senhas, IPs de
> servidor ou dados de clientes reais nos arquivos versionados.

## Como funciona

1. **Coleta**: RSS de InfoMoney, Money Times, Brazil Journal e Veja Economia.
2. **Filtro de palavras-chave**: lista ampla em `manutencao/scripts/editorial_selection.js`,
   com 15 categorias (bancos e instituições, empresas e bolsa, renda variável,
   renda fixa e crédito, fundos e investimentos, economia brasileira, política
   e judiciário, exterior, geopolítica, commodities, câmbio, setores da bolsa,
   mercado e fluxo, eventos relevantes etc.).
3. **Seleção com Gemini**: prioriza notícias com potencial de impacto em
   mercados, investimentos, empresas, juros, inflação, câmbio, bolsa ou
   decisões de investidores; ignora as sem relevância financeira ou econômica,
   mesmo que contenham alguma palavra-chave; prioriza as últimas 24 horas e
   destaca quando há fato novo de grande impacto.
4. **Envio programado**: `periodicidade` (intervalo/diário), `intervaloMinutos`,
   `inicioEnvios`/`fimEnvios` e `horarioEnvioDiario` configuráveis no card
   **Configurar Cliente**. Cada notícia sai com texto didático que explica o
   que aconteceu e por que importa, e com a imagem da matéria quando disponível.
5. **Resumão do dia**: no `horarioResumao`, uma única mensagem (sem divisões
   nem cortes) com TODAS as notícias confirmadas como enviadas naquele dia.
   A partir desse horário as notícias individuais param até o início do dia
   seguinte.
6. **Histórico persistente** (`evolution/noticias-estado/`): evita repetição
   de notícias entre execuções e separa os destinos; uma notícia só entra no
   resumão depois que a Evolution confirma o envio.

## Configuração no n8n

1. Importe `noticias_investimento_whatsapp.json`. O workflow importa **inativo**
   e com `enviar=false`.
2. No card **Configurar Cliente**, ajuste `cliente`, `instancia`, `numero`,
   `evolutionUrl`, `modeloGemini`, `estadoUrl`, `periodicidade`, horários e
   demais campos.
3. Crie a credencial **Header Auth** do Gemini (Name `x-goog-api-key`, Value sua
   chave) e a da Evolution (Name `apikey`, Value do token da instância).
   Selecione-as nos cards correspondentes. O histórico exige a credencial
   **Header Auth** do serviço `noticias-estado`.
4. `enviar=false` apenas revisa; `enviar=true` envia. Publique o workflow após
   configurar.

As credenciais são configuradas no próprio n8n e **nunca** ficam neste
repositório. O serviço de histórico (`evolution/noticias-estado/`) e o Docker
da Evolution estão documentados em `evolution/README.md`.

## Organização

| Local | Finalidade |
| --- | --- |
| `noticias_investimento_whatsapp.json` | Workflow completo para importar/compartilhar (sem segredos). |
| `manutencao/scripts/` | Fontes dos cards e ferramentas de manutenção. |
| `manutencao/testes/` | Testes locais (`test_keywords`, `test_editorial`, `test_news_state` etc.). |
| `evolution/` | Docker da Evolution API, serviço de histórico e documentação. |

> Este repositório é **público**: não inclua tokens, chaves, senhas, IPs de
> servidor ou dados de clientes reais nos arquivos versionados.