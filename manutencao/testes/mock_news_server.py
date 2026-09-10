"""Servidor descartável do teste integrado. Jamais envia mensagens reais."""
import app
import json
from datetime import datetime
from http.server import ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

hour = 8
gemini_calls = 0
sends = []


class Mock(app.Handler):
    def do_GET(self):
        global hour
        path = urlparse(self.path)
        if path.path == '/test/clock':
            hour = int(parse_qs(path.query)['hour'][0])
            return self.reply(200, {'hour': hour})
        if path.path == '/test/stats':
            return self.reply(200, {'gemini_calls': gemini_calls, 'sends': sends})
        if path.path == '/article':
            body = ('<html><head><meta property="og:image" content="https://example.com/capa.jpg"></head><article><p>' +
                    'A empresa apresentou receita de 100 milhões no trimestre e explicou a evolução de suas atividades. ' * 8 + '</p></article></html>').encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html')
            self.end_headers()
            self.wfile.write(body)
            return
        return super().do_GET()

    def do_POST(self):
        global gemini_calls
        data = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        if self.path == '/gemini':
            gemini_calls += 1
            if gemini_calls == 1:
                return self.reply(503, {'error': {'message': 'Falha temporária simulada'}})
            prompt = data['contents'][0]['parts'][0]['text']
            fontes = json.loads(prompt.rsplit('FONTES: ', 1)[1])
            result = [{'id': f['id'], 'emoji': '📊', 'titulo': f['titulo'].upper(),
                       'resumo': 'A empresa divulgou os resultados do trimestre, com receita de 100 milhões conforme os dados da fonte. Isso permite entender a evolução das atividades no período.\n\nO comunicado explica o contexto dos resultados e seus indicadores, sem apresentar uma previsão de valorização das ações.'} for f in fontes]
            return self.reply(200, {'candidates': [{'finishReason': 'STOP', 'content': {'parts': [{'text': json.dumps(result)}]}}]})
        if self.path.startswith('/message/'):
            assert data['number'] == '5511999999999'
            text = data.get('text') or data.get('caption')
            sends.append({'kind': 'image' if data.get('media') else 'text', 'characters': len(text), 'digest': 'RESUMÃO DO MERCADO' in text})
            return self.reply(200, {'key': {'id': 'mock-' + str(len(sends))}, 'status': 'PENDING'})
        try:
            result = app.dispatch(self.path, data, datetime(2026, 9, 10, hour, 0, tzinfo=app.TZ).timestamp())
            self.reply(200, result)
        except Exception as e:
            self.reply(400, {'error': str(e)})


app.initialize()
ThreadingHTTPServer(('0.0.0.0', 8090), Mock).serve_forever()
