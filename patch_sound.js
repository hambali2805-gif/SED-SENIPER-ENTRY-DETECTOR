const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

// Target fungsi playAlertSound
const startStr = "const playAlertSound = (tone: 'hot' | 'warn' | 'ok' = 'ok', force = false) => {";
const endStr = "  };";

// Ganti bagian if (tone === 'hot') dengan pattern alarm HP yang tinggi
const newSoundCode = `const playAlertSound = (tone: 'hot' | 'warn' | 'ok' = 'ok', force = false) => {
    if (!soundEnabled && !force) return;
    const now = Date.now();
    if (!force && now - lastSoundRef.current < 20000) return;
    lastSoundRef.current = now;
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = audioCtxRef.current || new Ctx();
      audioCtxRef.current = ctx;
      const t = ctx.currentTime + 0.02;
      
      // ALARM SIREN MODE
      if (tone === 'hot') {
        // Pattern melengking: 1500Hz - 2500Hz, waveform SAWTOOTH (lebih tajam/kasar)
        [1500, 2500, 1500, 2500, 1500, 2500].forEach((f, i) => playTone(ctx, f, t + i * 0.12, 0.12, 'sawtooth'));
        setTimeout(() => { 
            try { 
                [2500, 1500, 2500, 1500, 2500, 1500].forEach((f, i) => playTone(ctx, f, ctx.currentTime + i * 0.12, 0.12, 'sawtooth')); 
            } catch {} 
        }, 800);
      } else if (tone === 'warn') {
        [800, 1200, 800, 1200].forEach((f, i) => playTone(ctx, f, t + i * 0.20, 0.18, 'square'));
      } else {
        [520, 660].forEach((f, i) => playTone(ctx, f, t + i * 0.22, 0.16, 'sine'));
      }
      if (navigator.vibrate) {
        navigator.vibrate(tone === 'hot' ? [500, 100, 500, 100, 500] : [200, 100, 200]);
      }
    } catch {}
  };`;

// Regex untuk mengganti fungsi
const regex = /const playAlertSound = \(tone: 'hot' \| 'warn' \| 'ok' = 'ok', force = false\) => \{[\s\S]*?\}\s*?;/g;

if (regex.test(content)) {
    content = content.replace(regex, newSoundCode);
    fs.writeFileSync(file, content);
    console.log(">> LOGIKA SUARA ALARM HIGH-PITCH BERHASIL DISUNTIKKAN! <<");
} else {
    console.log(">> GAGAL MENCARI FUNGSI playAlertSound! <<");
}
