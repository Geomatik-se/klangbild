# Kleiner Entwicklungs-Server: wie "python -m http.server", aber mit
# Cache-Control: no-cache, damit der Browser Aenderungen sofort sieht.
# Start:  python serve.py  [Port, Standard 8081]
import http.server
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8081


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


if __name__ == '__main__':
    with http.server.ThreadingHTTPServer(('', PORT), NoCacheHandler) as httpd:
        print(f'Klangbild laeuft auf http://localhost:{PORT}')
        httpd.serve_forever()
