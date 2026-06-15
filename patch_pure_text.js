const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

// Logika baru: Paksa fungsi Telegram hanya menembak endpoint sendMessage dengan format HTML
const pureTextTelegramCode = `const sendTelegramAlert = async (text: string) => {
    const token = localStorage.getItem('tele_token') || '';
    const chatId = localStorage.getItem('tele_chat_id') || '';
    if (!token || !chatId) return;
    
    try {
      // Paksa murni menggunakan sendMessage (Teks Sahaja)
      const url = \`https://api.telegram.org/bot\${token}/sendMessage\`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: 'HTML',
          disable_web_page_preview: true
        })
      });
      if (!response.ok) console.log('Telegram text-only failed');
    } catch (err) {
      console.error('Telegram error:', err);
    }
  };`;

// Cari fungsi lama sendTelegramAlert dari awal sampai akhir kurung kurawal fungsinya
const oldTeleFunctionRegex = /const sendTelegramAlert = async[\s\S]*?\}\s*?\}\s*?;\s*?\}\s*?;/g;
const oldTeleFunctionRegexAlt = /const sendTelegramAlert = async[\s\S]*?\}\s*?;\s*?\n\s*?const/g;

if (content.includes('sendTelegramAlert')) {
    // Kita ganti blok fungsi lamanya dengan versi super ringkas & kencang ini
    // Untuk memastikan aman, kita lakukan pendekatan replace string berbasis jangkar pembuka
    const startIdx = content.indexOf('const sendTelegramAlert = async');
    // Cari penutup fungsi yang mendekati sebelum fungsi berikutnya (biasanya playAlertSound atau useEffect)
    let endIdx = content.indexOf('const playAlertSound', startIdx);
    if (endIdx === -1) endIdx = content.indexOf('useEffect', startIdx);
    
    if (startIdx !== -1 && endIdx !== -1) {
        const oldBlock = content.substring(startIdx, endIdx);
        content = content.replace(oldBlock, pureTextTelegramCode + '\n  \n  ');
        fs.writeFileSync(file, content);
        console.log(">> SUKSES! FITUR CHART TELEGRAM DINONAKTIFKAN, SEKARANG 100% PURE TEXT! <<");
    } else {
        console.log(">> GAGAL MENENTUKAN BATAS FUNGSI TELEGRAM. <<");
    }
} else {
    console.log(">> FUNGSI TELEGRAM TIDAK DITEMUKAN. <<");
}
