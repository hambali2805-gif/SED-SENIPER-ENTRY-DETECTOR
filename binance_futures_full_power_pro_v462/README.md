# Binance Futures Full Power Pro v2.0

LIVE ONLY dashboard untuk Binance USD-M Futures.

## Fitur v2.0

- Chart utama di atas.
- Flow Scoring Engine: funding, OI, global L/S, top trader L/S, taker flow, MTF, dan order wall.
- Sniper Status Engine: LONG VALID, LONG READY, LONG RISKAN, SHORT VALID, SHORT READY, SHORT RISKAN, WAIT, NO TRADE.
- Mini Liquidity Map v2 dari order book depth + long/short ratio.
- Market Scanner Pro compact dan scrollable.
- Alert Center.
- Copy Plan.
- LIVE ONLY: tidak ada demo price.

## Jalankan di HP / Termux tanpa npm install

```bash
cd /sdcard/Download
unzip binance_futures_full_power_pro_v20.zip
cd binance_futures_full_power_pro_v20/dist
python -m http.server 5173 --bind 0.0.0.0
```

Buka Chrome:

```text
http://127.0.0.1:5173
```

## Catatan

Mini Liquidity Map memakai order book Binance sebagai proxy buy/sell limit wall. Ini bukan liquidation heatmap asli seperti Coinglass dan tidak bisa memastikan order itu open long/short atau close posisi.


## v2.2 Update
- SNR Engine v2: active timeframe + major timeframe, score-based zones, support/resistance bands.
- Real-Time Chart Engine: Binance Futures kline WebSocket updates active candle.
- WS status indicator in dashboard.
- OB/SNR/Structure layers remain toggleable.


## v2.3 Accuracy Engine
- SNR Engine v3: stricter scoring, active + major timeframe zones, broken-level filtering.
- OB Engine v2: strong/medium/weak quality, mitigated/invalidated filtering, displacement + close break requirement.
- Structure Engine v2: close-confirmed BOS/CHoCH logic and cleaner bias.
- Confluence Score: Structure + OB + SNR + Flow + Liquidity.
- Sniper Plan v2: VALID requires stronger OB + near-zone + confluence.


## v2.4 Sniper Workflow Update
- Sniper Mode: AGGRESSIVE / NORMAL / CONSERVATIVE.
- Threshold VALID/READY/RISKAN now follows selected sniper mode.
- Hot Setup Watchlist Lite: HOT LONG / HOT SHORT / WAITLIST / NO TRADE.
- Smart Alert Center improved: OB/SNR proximity, confluence, WS status.
- Save settings to localStorage: pair, timeframe, zoom, layers, sniper mode, live sync.
- Reset Stream button for WebSocket reconnect + live data reload.


## v2.5 Fixed Sniper Anchor TF
- Chart timeframe is display-only.
- Sniper plan no longer changes entry anchor when user switches chart timeframe.
- Fixed model:
  - Bias TF: 4H + 1H
  - Entry zone / POI: 15M
  - Trigger + invalidation: 5M
- Sniper output now shows ENTRY MODEL and fixed anchor notice.
- Alerts and plan now use 15M OB/SNR as entry anchor.


## v2.6 Touch Fullscreen Chart
- Added Fullscreen Chart mode.
- Added touch pan by dragging chart left/right.
- Added pinch zoom on mobile.
- Added crosshair + OHLC hover/touch.
- Added Reset View button.
- Fixed Sniper Anchor remains unchanged:
  - Bias: 4H + 1H
  - Entry Zone: 15M
  - Trigger/Invalidation: 5M

## v2.7 TradingView Touch Chart + Top Alert Panel
- Added right price-scale touch drag for vertical zoom, similar TradingView price scale.
- Added vertical chart body drag for manual price pan.
- Added Auto Scale button and Reset View.
- Smart Alert compact panel moved to the top sidebar under Market.
- Full Alert Detail remains lower in the dashboard.
- Fixed Sniper Anchor remains unchanged: 4H+1H bias, 15M entry, 5M trigger/invalidation.


## v2.7.1 Layout Fix
- Smart Alert moved to a separate top panel beside Market.
- Smart Alert removed from inside Market column.
- Bottom Alert Detail section removed to avoid duplicate alerts.
- Fixed Sniper Anchor remains unchanged:
  - Bias: 4H + 1H
  - Entry Zone: 15M
  - Trigger/Invalidation: 5M


## v3.2 Workflow Pack
Included:
- v2.8 Favorite/Custom Watchlist
  - Favorite coins with star button.
  - Favorites-only filter.
  - Favorite list persisted in localStorage.
  - Hot Setup focuses on favorites when favorites exist.

- v2.9 Entry Zone Alerts
  - Smart Alert warns when price is near/inside 15M entry zone.
  - OB/SNR proximity alerts preserved.

- v3.0 Plan History
  - Last 5 sniper plans stored locally.
  - Copy old plan from history.
  - Clear history button.

- v3.2 Export / Screenshot Analysis
  - Save current chart as PNG.
  - Export sniper plan as TXT.
  - Copy plan remains available.

Not included:
- v3.1 Compact Trading Mode (intentionally skipped).


## v3.9 Sniper Entry System Focus
Bybit Demo/Bridge removed for Termux performance.

Main changes:
- Favorite Coin Alert Engine:
  - Scans favorite coins in background.
  - Uses 4H + 1H for bias, 15M for entry zone, 5M for trigger.
  - Alerts when favorite coins are inside/near 15M SNR/OB entry zone.
  - Alert card is clickable and opens the symbol.
- Favorite Alert Center:
  - Replaces single-coin-only alert behavior.
  - Shows ENTRY HIT / NEAR ENTRY / VALID SETUP / WATCH.
- Lightweight REST polling:
  - Scans up to 16 favorite coins every 45 seconds.
  - Designed for HP + Termux.
- Sound alert:
  - Enable Sound button.
  - Beep/vibration for hot/warn favorite alerts.
- Bybit page and bridge removed.


## v3.9.1 Branding Update
- Rebrand header/logo to Sniper Entry Detector
- Added compact logo in navbar and full brand panel
- Updated browser title and favicon
- Preserved lightweight sniper-entry-focused build for Termux


## v3.9.2 Cleanup
- Removed middle branding logo panel
- Removed Sniper Entry Detector Pro / Favorite Coin Entry Radar section
- Kept compact header logo only for cleaner layout


## v3.9.3 Alert Cleanup
- Removed Sniper Watchlist Lite section.
- Favorite Alert Center is now the main watchlist alert system.
- Added longer alert sound and stronger vibration pattern.
- Added optional Telegram alert delivery for favorite alerts.
- Telegram settings are stored locally in browser localStorage.


## v3.9.4 Telegram Status Fix
- Telegram status now switches to READY when enabled and token/chat ID are filled.
- Added Test Telegram button.
- Telegram Alert Center status is easier to verify before real alerts fire.


## v3.9.5 Scroll Fix
- Fixed Market column internal scroll on mobile/tablet.
- Fixed Favorite Alert Center internal scroll.
- Added touch-friendly scrolling with overscroll containment.
- Kept Telegram READY/Test patch from v3.9.4.


## v3.9.6 Chart Controls Cleanup
- Removed Interval Chart and Zoom from Market/Settings column.
- Moved Zoom control into Professional Chart controls.
- Timeframe buttons now belong visually inside chart controls.
- Market column is now cleaner and only contains market/watchlist/settings relevant controls.


## v4.1 Full Alert Accuracy Upgrade
Merged v3.9.7 to v4.1 roadmap:
- Alert Quality Filter:
  - hides weak WATCH/noise alerts
  - prioritizes ENTRY HIT and NEAR ENTRY
  - cleaner Favorite Alert Center
- Favorite Alert Detail Card:
  - Score, Distance, HTF, Trigger, Zone, and Action shown directly on alert card.
- Telegram Premium Message:
  - clearer formatted message
  - includes zone, distance, score, HTF, trigger and suggested action.
- Telegram Important Only:
  - default sends only ENTRY HIT and NEAR ENTRY.
  - can be disabled to also send VALID SETUP.
- Favorite Radar Accuracy Upgrade:
  - improved HTF 4H/1H scoring
  - 15M SNR/OB zone scoring
  - 5M trigger/reaction scoring
  - volume boost and structure filter.
- Alert Mode:
  - AGGRESSIVE = more early warnings
  - NORMAL = balanced
  - STRICT = only high quality close-to-zone alerts


## v4.2 1H OB Anchor + 15M Refinement + 5M Candlestick Trigger
- Changed main entry logic:
  - 4H = macro bias
  - 1H = main Order Block / Supply Demand anchor
  - 15M = refinement zone
  - 5M = candlestick trigger
- Added 5M pattern engine:
  - Bullish/Bearish Strong Engulfing
  - Pin Bar / Hammer / Shooting Star
  - Displacement Candle
  - Inside Bar Breakout
- Alert Center cleanup:
  - Favorite Alert Center now only shows favorite radar alerts
  - Generic active-coin notes are no longer mixed into the favorite alert center
  - Alerts must include 1H zone, 15M refinement, 5M trigger, distance, HTF, OB quality, score and action
- Telegram premium message now includes 1H Zone, 15M Refinement, 5M Trigger and OB Quality.


## v4.3 Chart Overlay 1H/15M/5M
- Added visual overlay that follows v4.2 logic:
  - 1H OB / Supply-Demand main zone as thick overlay
  - 15M refinement as thinner inner overlay
  - 5M trigger marker when candlestick trigger is valid
  - Invalidation line from 1H OB boundary
  - Late Entry warning area when trigger appears too far from zone
- Chart subtitle updated to explain the 1H / 15M / 5M overlay model.
- Dashboard stays compact; no new big panel added.


## v4.4 Drag Chart Pan
- Added horizontal chart drag/pan for mouse and touch.
- Drag left/right on chart to move through historical candles.
- Drag right-side price scale to adjust vertical scale.
- Pinch gesture still controls zoom.
- Reset View returns chart to latest candles.


## v4.6 Exact Entry + Telegram Chart Signal
- Tambah exact entry ladder: Aggressive, Main, Conservative, Stop Loss, TP1-TP3.
- Favorite Alert Center kini tampilkan harga entry exact + SL/TP.
- Telegram punya mode TEXT ONLY / TEXT + CHART. Test Telegram kirim chart canvas aktif.
- Jika symbol alert = symbol chart aktif, tool akan kirim chart ke Telegram via sendPhoto.

## v4.5 Dominant Overlay + Center Last Candle
- Default chart overlay focuses on the dominant setup side:
  - If selected alert is SHORT, chart shows short-side 1H OB/refinement.
  - If selected alert is LONG, chart shows long-side 1H OB/refinement.
  - Opposite setup no longer clutters the default chart.
- Last candle can be dragged left into the middle of the chart by allowing future/right-side empty space.
- Added Center Last button to immediately move the latest candle near the center.
- Late-entry warning is now compact and no longer covers the candles.


## v4.6.1 Telegram Chart Fix
- Fix mode TEXT + CHART agar gambar chart tidak gagal karena caption terlalu panjang.
- Telegram sekarang mengirim 2 pesan:
  1. Photo chart dengan caption pendek.
  2. Full detail signal sebagai text terpisah.
- Jika photo gagal, tool tetap mengirim full signal text sebagai fallback.


## v4.6.2 Telegram Simple Mode
- Telegram tidak lagi mengirim detail signal panjang.
- Mode TEXT + CHART sekarang hanya mengirim 1 photo chart dengan caption ringkas:
  Pair, status, price, Entry A/M/C, SL, TP1/TP2/TP3, score.
- Jika photo gagal, fallback mengirim text ringkas saja.
