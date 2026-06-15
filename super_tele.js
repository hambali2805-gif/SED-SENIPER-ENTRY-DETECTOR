const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

// Cari awal mula fungsi Telegram
const startIdx = content.indexOf('const sendTelegramAlert =');
if (startIdx === -1) {
    console.log(">> GAGAL! FUNGSI TELEGRAM TIDAK DITEMUKAN <<");
    process.exit(1);
}

// Hitung kurung kurawal untuk menemukan ujung fungsi secara presisi
let bracketCount = 0;
let foundFirstBracket = false;
let endIdx = -1;

for (let i = startIdx; i < content.length; i++) {
    if (content[i] === '{') {
        bracketCount++;
        foundFirstBracket = true;
    } else if (content[i] === '}') {
        bracketCount--;
    }
    if (foundFirstBracket && bracketCount === 0) {
        endIdx = i;
        break;
    }
}

if (endIdx !== -1) {
    const oldFunction = content.substring(startIdx, endIdx + 1);

    // Otak baru Telegram: Pure Text & Format Ganteng
    const newFunction = `const sendTelegramAlert = async (text: any, chartCanvas?: any) => {
    const token = localStorage.getItem('tele_token') || '';
    const chatId = localStorage.getItem('tele_chat_id') || '';
    if (!token || !chatId) return;

    let finalMessage = text;
    try {
        // Bongkar teks lama
        let symbolMatch = text.match(/🎯 (.*?) • (.*)/);
        let priceMatch = text.match(/Price: (.*)/);
        let entryMatch = text.match(/Entry: A (.*?) • M (.*?) • C (.*)/);
        let slMatch = text.match(/SL: (.*)/);
        let tpMatch = text.match(/TP: (.*?) \\/ (.*?) \\/ (.*)/);
        let scoreMatch = text.match(/Score: (.*)/);

        if (symbolMatch) {
            let symbol = symbolMatch[1];
            let setup = symbolMatch[2];
            let price = priceMatch ? priceMatch[1] : '-';
            let eA = entryMatch ? entryMatch[1] : '-';
            let eM = entryMatch ? entryMatch[2] : '-';
            let eC = entryMatch ? entryMatch[3] : '-';
            let sl = slMatch ? slMatch[1] : '-';
            let tp1 = tpMatch ? tpMatch[1] : '-';
            let tp2 = tpMatch ? tpMatch[2] : '-';
            let tp3 = tpMatch ? tpMatch[3] : '-';
            let score = scoreMatch ? scoreMatch[1] : '-';

            // Rakit teks baru yang ganteng
            finalMessage = \`🚨 <b>SIGNAL ALERT : \${symbol}</b> 🚨\\n\\n\` +
                           \`📈 <b>Setup:</b> \${setup}\\n\` +
                           \`🔥 <b>Score:</b> \${score}\\n\` +
                           \`⚡ <b>Leverage:</b> 25x - 50x (Cross/Isol)\\n\` +
                           \`💵 <b>Current Price:</b> \${price}\\n\\n\` +
                           \`🎯 <b>ENTRY ZONE:</b>\\n\` +
                           \`• A (Aggressive) : \${eA}\\n\` +
                           \`• M (Moderate) : \${eM}\\n\` +
                           \`• C (Conservative) : \${eC}\\n\\n\` +
                           \`💰 <b>TAKE PROFIT (TP):</b>\\n\` +
                           \`• TP1 : \${tp1}\\n\` +
                           \`• TP2 : \${tp2}\\n\` +
                           \`• TP3 : \${tp3}\\n\\n\` +
                           \`🛑 <b>STOP LOSS (SL):</b> \${sl}\`;
        }
    } catch (e) {
        console.log('Parse text failed, sending raw text');
    }

    try {
        // Tembak langsung murni pakai sendMessage (Tanpa Gambar)
        const url = \`https://api.telegram.org/bot\${token}/sendMessage\`;
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: finalMessage,
                parse_mode: 'HTML',
                disable_web_page_preview: true
            })
        });
    } catch (err) {
        console.error('Telegram error:', err);
    }
}`;

    content = content.replace(oldFunction, newFunction);
    fs.writeFileSync(file, content);
    console.log(">> SUKSES BRUTAL! OTAK TELEGRAM BERHASIL DIGANTI TOTAL! <<");
} else {
    console.log(">> GAGAL MENEMUKAN UJUNG FUNGSI TELEGRAM <<");
}
