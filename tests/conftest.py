"""Sert le dossier site/ en local pendant les tests, comme en ligne."""
import http.server, socketserver, threading, functools, os, pytest
SITE = os.path.join(os.path.dirname(__file__), '..', 'site')
PORT = int(os.environ.get('TEST_PORT', '4173'))

@pytest.fixture(scope='session')
def base_url():
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a): pass
    handler = functools.partial(Quiet, directory=SITE)
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.ThreadingTCPServer(('127.0.0.1', PORT), handler)
    t = threading.Thread(target=srv.serve_forever, daemon=True); t.start()
    yield f'http://127.0.0.1:{PORT}'
    srv.shutdown()
