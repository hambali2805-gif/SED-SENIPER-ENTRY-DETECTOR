import urllib.request, json, time, threading, ssl
from http.server import BaseHTTPRequestHandler, HTTPServer

active_alerts = []
volume_memory = {}

def binance_radar():
    global active_alerts, volume_memory
    url = "https://fapi.binance.com/fapi/v1/ticker/24hr"
    ctx = ssl.create_default_context(); ctx.check_hostname = False; ctx.verify_mode = ssl.CERT_NONE
    
    while True:
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=10, context=ctx) as response:
                data = json.loads(response.read().decode())
                for t in data:
                    symbol = t.get("symbol"); vol = float(t.get("quoteVolume", 0))
                    if symbol.endswith("USDT") and "_" not in symbol:
                        if symbol in volume_memory and volume_memory[symbol] > 0:
                            increase = ((vol - volume_memory[symbol]) / volume_memory[symbol]) * 100
                            if increase > 0.05: # Sensitivitas tinggi
                                new_entry = {"symbol": symbol, "spike": round(increase, 2), "time": time.strftime("%H:%M")}
                                if new_entry not in active_alerts:
                                    active_alerts = [new_entry] + active_alerts
                                    active_alerts = active_alerts[:8]
                        volume_memory[symbol] = vol
        except: pass
        time.sleep(5)

class APIHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*'); self.send_header('Content-type', 'application/json'); self.end_headers()
        if self.path == '/api/alerts': self.wfile.write(json.dumps(active_alerts).encode())
    def log_message(self, format, *args): pass

threading.Thread(target=binance_radar, daemon=True).start()
HTTPServer(('', 8081), APIHandler).serve_forever()
