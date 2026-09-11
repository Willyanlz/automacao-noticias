# Noticias para WhatsApp - n8n + Evolution + Gemini

Automacao compacta de noticias de investimento para WhatsApp. A versao oficial e a V3 compacta em `noticias_v3.json`.

## O que fica

- `noticias_v3.json`: workflow principal para importar no n8n.
- `create_v3_compact.js`: gerador reproduzivel do workflow V3.
- `historico/`: servico SQLite minimo para deduplicacao e resumao do dia.
- `evolution/docker-compose.yml`: stack Evolution API + historico.
- `manutencao/testes/test_v3_compact.cjs`: teste local de integridade do workflow.

## Funcionalidades

- Agendamento a cada minuto e execucao manual.
- Periodicidade por intervalo ou diaria.
- Janela de envio e horario de resumao.
- RSS de InfoMoney, Money Times, BrazilJournal e Veja.
- Deduplicacao e historico persistente.
- Gemini com retry interno.
- Envio por texto ou imagem via Evolution API.
- Intervalo de 8 a 10 segundos entre mensagens.
- Consulta separada de IDs de grupos/instancia do WhatsApp.

## Teste local

```bash
node create_v3_compact.js
node manutencao/testes/test_v3_compact.cjs
```

## Importacao no n8n

1. Importe `noticias_v3.json`.
2. Ajuste `Configurar Cliente` e `Configurar Cliente - IDs`.
3. Preencha `geminiApiKey`, `evolutionApiKey`, `numero`, `instancia` e horarios.
4. Use `enviar=false` para previa e `enviar=true` para envio real.

Nao versione tokens, chaves, senhas, IPs privados de clientes ou exports com credenciais.
