import http.server
import socketserver

PORT = 8090
Handler = http.server.SimpleHTTPRequestHandler

class MyServer(socketserver.TCPServer):
    allow_reuse_address = True

with MyServer(("", PORT), Handler) as httpd:
    print(f"🔥 PILOT OK - SENTINEL ORIGINAL AKTIF DI PORT {PORT}")
    httpd.serve_forever()
