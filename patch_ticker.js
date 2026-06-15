const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

const tickerCode = `
      {/* Ticker Berjalan */}
      <div className="marquee-container">
        <div className="marquee-content">
          {tickers.slice(0, 60).map((t, i) => (
            <div key={t.symbol} className="ticker-item">
              <span className="text-gray-400">{t.symbol.replace('USDT', '')}</span>
              <span className={Number(t.priceChangePercent) >= 0 ? 'greenText' : 'redText'}>
                {Number(t.priceChangePercent) >= 0 ? '▲' : '▼'} {fmtPct(t.priceChangePercent)}
              </span>
            </div>
          ))}
        </div>
      </div>
    `;

// Inject sebelum tutup div app terakhir
const lastClosingDivIndex = content.lastIndexOf('</div>');
if (lastClosingDivIndex !== -1) {
  content = content.substring(0, lastClosingDivIndex) + tickerCode + content.substring(lastClosingDivIndex);
  fs.writeFileSync(file, content);
  console.log(">> LOGIKA TICKER BERJALAN BERHASIL DISUNTIKKAN! <<");
} else {
  console.log(">> GAGAL MENCARI POSISI INJECT! <<");
}
