import urllib.request
import json
import time
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

active_alerts = []
volume_memory = {}

def bitunix_radar():
    global active_alerts, volume_memory
    url = "https://openapi.bitunix.com/api/v1/market/tickers"
    print("🔥 [ENGINE START] MODE NUKLIR AKTIF!")
    print("⏳ Menunggu 5 detik untuk tembakan pertama ke UI...")
    
    while True:
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode())
            
            if data.get("code") == 0:
                tickers = data.get("data", [])
                new_alerts = []
                
                # Kita ambil 3 koin pertama aja biar layar lu gak meledak
                for t in tickers[:3]:
                    symbol = t.get("symbol")
                    if not symbol.endswith("USDT"): continue
                    
                    # MODE NUKLIR: Langsung tembak tanpa peduli persentase volume!
                    print(f"🚨 [TEST NUKLIR] {symbol} berhasil disedot!")
                    new_alerts.append({
                        "symbol": symbol,
                        "spike": 99.99, # Angka buatan untuk ngetes UI
                        "time": time.strftime("%H:%M:%S")
                    })
                            
                if new_alerts:
                    active_alerts = new_alerts + active_alerts
                    active_alerts = active_alerts[:10]
                    
        except Exception as e:
            pass
        
        time.sleep(5)

class APIHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        if self.path == '/api/alerts':
            response = {"status": "success", "data": active_alerts}
            self.wfile.write(json.dumps(response).encode())
        else:
            self.wfile.write(b'{"status": "ready"}')
            
    def log_message(self, format, *args):
        pass

def run_server():
    server_address = ('', 8081)
    httpd = HTTPServer(server_address, APIHandler)
    httpd.serve_forever()

if __name__ == '__main__':
    threading.Thread(target=bitunix_radar, daemon=True).start()
    run_server()
