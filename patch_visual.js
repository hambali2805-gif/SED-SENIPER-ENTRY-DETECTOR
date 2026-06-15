const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

// Mencari titik injeksi tepat setelah pelukis Order Block selesai bekerja
const regex = /(ctx\.fillText\(ob\.type === 'BULLISH_OB' \? 'BULL OB' : 'BEAR OB', left \+ 4, top \+ 12\);\s*}\);)/;

const fvgVisualCode = `
          // === DRAW FVG (FAIR VALUE GAP) ===
          for (let i = 2; i < active.length; i++) {
            const c0 = active[i - 2];
            const c1 = active[i - 1];
            const c2 = active[i];
            
            // Cek Bullish FVG (c2 Low > c0 High)
            if (c2.l > c0.h && c1.c > c1.o) {
              let mitigated = false;
              let endIdx = active.length - 1;
              for(let j = i + 1; j < active.length; j++) {
                  if (active[j].l <= c0.h) { mitigated = true; endIdx = j; break; }
              }
              if (!mitigated || endIdx > i) {
                const topY = y(c2.l);
                const bottomY = y(c0.h);
                const startX = x(i - 1);
                const endX = mitigated ? x(endIdx) : margin.left + chartW;
                
                ctx.fillStyle = 'rgba(57, 255, 20, 0.15)'; 
                ctx.fillRect(startX, topY, endX - startX, bottomY - topY);
                ctx.strokeStyle = 'rgba(57, 255, 20, 0.6)';
                ctx.setLineDash([2, 4]);
                ctx.strokeRect(startX, topY, endX - startX, bottomY - topY);
                ctx.setLineDash([]);
                ctx.fillStyle = '#39ff14';
                ctx.font = 'bold 9px monospace';
                ctx.fillText('FVG', startX + 4, topY + 9);
              }
            }
            
            // Cek Bearish FVG (c2 High < c0 Low)
            if (c2.h < c0.l && c1.c < c1.o) {
              let mitigated = false;
              let endIdx = active.length - 1;
              for(let j = i + 1; j < active.length; j++) {
                  if (active[j].h >= c0.l) { mitigated = true; endIdx = j; break; }
              }
              if (!mitigated || endIdx > i) {
                const topY = y(c0.l);
                const bottomY = y(c2.h);
                const startX = x(i - 1);
                const endX = mitigated ? x(endIdx) : margin.left + chartW;
                
                ctx.fillStyle = 'rgba(255, 68, 68, 0.15)'; 
                ctx.fillRect(startX, topY, endX - startX, bottomY - topY);
                ctx.strokeStyle = 'rgba(255, 68, 68, 0.6)';
                ctx.setLineDash([2, 4]);
                ctx.strokeRect(startX, topY, endX - startX, bottomY - topY);
                ctx.setLineDash([]);
                ctx.fillStyle = '#ff4444';
                ctx.font = 'bold 9px monospace';
                ctx.fillText('FVG', startX + 4, topY + 9);
              }
            }
          }`;

if (content.includes("=== DRAW FVG")) {
    console.log(">> FVG SUDAH PERNAH DITAMBAHKAN KE CANVAS! <<");
} else if (regex.test(content)) {
    content = content.replace(regex, "$1\n" + fvgVisualCode);
    fs.writeFileSync(file, content);
    console.log(">> LOGIKA VISUAL FVG BERHASIL DISUNTIKKAN KE CHART! <<");
} else {
    console.log(">> GAGAL MENCARI TARGET INJECT DI APP.TSX! <<");
}
