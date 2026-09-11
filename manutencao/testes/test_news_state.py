import importlib.util
from pathlib import Path
import tempfile
import unittest
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

spec = importlib.util.spec_from_file_location('news_state', Path(__file__).parents[2] / 'evolution/noticias-estado/app.py')
app = importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)


class NewsStateTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        app.DB = str(Path(self.tmp.name) / 'state.sqlite')
        app.initialize()
        self.c = dict(numero='5511999999999', instancia='teste', evolutionUrl='http://mock', enviar=True,
                      inicioEnvios='08:00', fimEnvios='20:00', horarioResumao='19:00', intervaloMinutos=60,
                      periodicidade='intervalo', horarioEnvioDiario='08:00', maxNoticias=5)

    def tearDown(self):
        self.tmp.cleanup()

    def t(self, hour, minute=0, day=10):
        return datetime(2026, 9, day, hour, minute, tzinfo=app.TZ).timestamp()

    def tick(self, hour, minute=0, day=10, owner='a', config=None):
        return app.dispatch('/tick', {'config': config or self.c, 'executionId': owner}, self.t(hour, minute, day))

    def article(self, suffix='a'):
        return {'titulo': 'Título ' + suffix, 'resumo': 'Explicação ' * 15, 'link': 'https://example.com/' + suffix}

    def send(self, plan, article, when):
        r = app.dispatch('/reserve', {'jobId': plan['jobId'], 'artigo': article}, when)
        self.assertTrue(r['enviar'])
        payload = dict(jobId=plan['jobId'], registroId=r['registroId'], messageId='mock-' + r['registroId'])
        app.dispatch('/confirm', payload, when)
        self.assertTrue(app.dispatch('/confirm', payload, when)['registrado'])
        return r

    def finish(self, plan, when):
        app.dispatch('/finish', {'jobId': plan['jobId']}, when)

    def test_hourly_no_repeat_and_complete_digest(self):
        self.assertEqual(self.tick(7)['acao'], 'nada')
        p = self.tick(8)
        self.assertEqual(self.tick(8)['jobId'], p['jobId'])
        self.assertEqual(self.tick(8, owner='another')['acao'], 'nada')
        self.send(p, self.article(), self.t(8, 1))
        self.finish(p, self.t(8, 2))
        self.assertEqual(self.tick(8, 30)['acao'], 'nada')
        p2 = self.tick(9, owner='next')
        f = app.dispatch('/filter', {'config': self.c, 'jobId': p2['jobId'], 'noticias': [self.article(), self.article('b')]}, self.t(9))
        self.assertEqual([a['link'] for a in f['noticias']], ['https://example.com/b'])
        self.send(p2, self.article('b'), self.t(9, 1))
        self.finish(p2, self.t(9, 2))
        d = self.tick(19, owner='digest')
        self.assertEqual(d['acao'], 'resumao')
        self.assertEqual(len(d['noticias']), 2)
        self.assertEqual(self.tick(19, 1, owner='other')['acao'], 'nada')
        self.send(d, {'mensagem': 'Resumo completo'}, self.t(19, 1))
        self.finish(d, self.t(19, 2))
        self.assertEqual(self.tick(20)['acao'], 'nada')
        self.assertEqual(self.tick(8, day=11)['acao'], 'noticias')

    def test_cutoff_rejects_late_news(self):
        p = self.tick(18)
        app.dispatch('/touch', {'jobId': p['jobId']}, self.t(18, 10))
        app.dispatch('/touch', {'jobId': p['jobId']}, self.t(18, 20))
        app.dispatch('/touch', {'jobId': p['jobId']}, self.t(18, 30))
        app.dispatch('/touch', {'jobId': p['jobId']}, self.t(18, 40))
        app.dispatch('/touch', {'jobId': p['jobId']}, self.t(18, 50))
        self.assertFalse(app.dispatch('/reserve', {'jobId': p['jobId'], 'artigo': self.article()}, self.t(19))['enviar'])
        self.assertEqual(self.tick(19)['acao'], 'nada')

    def test_half_hour_and_daily(self):
        c = {**self.c, 'intervaloMinutos': 30}
        p = self.tick(8, config=c)
        self.finish(p, self.t(8, 1))
        self.assertEqual(self.tick(8, 29, config=c)['acao'], 'nada')
        self.assertEqual(self.tick(8, 30, config=c)['acao'], 'noticias')
        c2 = {**self.c, 'numero': '5511888888888', 'periodicidade': 'diario', 'horarioEnvioDiario': '10:00'}
        self.assertEqual(self.tick(9, config=c2)['acao'], 'nada')
        p = self.tick(10, config=c2)
        self.finish(p, self.t(10, 1))
        self.assertEqual(self.tick(15, config=c2)['acao'], 'nada')

    def test_restart_canonicalization_and_destinations(self):
        p = self.tick(8)
        self.send(p, self.article(), self.t(8))
        app.initialize()
        variants = [dict(self.article('z'), link='https://www.example.com/a/?utm_source=x#top'), dict(self.article(), link='https://example.com/other')]
        self.assertEqual(app.dispatch('/filter', {'config': self.c, 'noticias': variants}, self.t(9))['noticias'], [])
        other = {**self.c, 'numero': '5511888888888'}
        self.assertEqual(len(app.dispatch('/filter', {'config': other, 'noticias': variants}, self.t(9))['noticias']), 2)

    def test_parallel_reservations_and_uncertain_delivery(self):
        p = self.tick(8)
        def reserve(_):
            return app.dispatch('/reserve', {'jobId': p['jobId'], 'artigo': self.article()}, self.t(8))
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = list(pool.map(reserve, range(8)))
        self.assertEqual(sum(r['enviar'] for r in results), 1)
        self.assertEqual(self.tick(19)['acao'], 'nada')  # Sem confirmação, não aparece no resumo.
        p2 = self.tick(8, day=11)
        self.assertFalse(app.dispatch('/reserve', {'jobId': p2['jobId'], 'artigo': self.article()}, self.t(8, day=11))['enviar'])

    def test_preview_and_first_install(self):
        p = app.dispatch('/tick', {'config': {**self.c, 'enviar': False}, 'manual': True}, self.t(23))
        self.assertTrue(p['previa'])
        self.assertEqual(p['jobId'], '')
        self.assertEqual(self.tick(8, 15)['acao'], 'nada')
        self.assertEqual(self.tick(9)['acao'], 'noticias')

    def test_manual_force_outside_window(self):
        # Manual + enviar=True FORA da janela (23h) cria job real e envia de verdade.
        p = app.dispatch('/tick', {'config': self.c, 'manual': True, 'executionId': 'manual-1'}, self.t(23))
        self.assertEqual(p['acao'], 'noticias')
        self.assertNotEqual(p['jobId'], '')
        self.assertFalse(p['previa'])
        # Reserva e confirma funcionam (envia na hora).
        r = app.dispatch('/reserve', {'jobId': p['jobId'], 'artigo': self.article()}, self.t(23, 1))
        self.assertTrue(r['enviar'])
        app.dispatch('/confirm', {'jobId': p['jobId'], 'registroId': r['registroId'], 'messageId': 'm-' + r['registroId']}, self.t(23, 2))
        # Reexecutar o mesmo manual-1 recria o job (idempotente por executionId).
        p2 = app.dispatch('/tick', {'config': self.c, 'manual': True, 'executionId': 'manual-1'}, self.t(23, 3))
        self.assertNotEqual(p2['jobId'], p['jobId'])
        # Manual + enviar=False segue como prévia (não envia).
        previa = app.dispatch('/tick', {'config': {**self.c, 'enviar': False}, 'manual': True, 'executionId': 'manual-2'}, self.t(23))
        self.assertTrue(previa['previa'])
        self.assertEqual(previa['jobId'], '')

    def test_timeout_recovery_and_heartbeat(self):
        p = self.tick(8)
        for m in (10, 20, 30, 40, 50):
            self.assertTrue(app.dispatch('/touch', {'jobId': p['jobId']}, self.t(8, m))['continuar'])
        self.assertEqual(self.tick(9, owner='second')['acao'], 'nada')
        p2 = self.tick(9, 11, owner='second')
        self.assertEqual(p2['acao'], 'noticias')
        self.assertFalse(app.dispatch('/reserve', {'jobId': p['jobId'], 'artigo': self.article()}, self.t(9, 12))['enviar'])

    def test_migration_preserves_days_and_is_idempotent(self):
        payload = {'config': self.c, 'entries': [dict(artigo=self.article(), sent=self.t(8, day=d), messageId='old-'+str(d)) for d in (9,10)]}
        self.assertEqual(app.dispatch('/seed', payload)['importados'], 2)
        self.assertEqual(app.dispatch('/seed', payload)['importados'], 0)
        self.assertEqual(len(self.tick(19)['noticias']), 1)


if __name__ == '__main__':
    unittest.main()
