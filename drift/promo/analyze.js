// Score the session log in sliding windows and pick the best non-overlapping highlight
// windows for the 20 s cut.  node analyze.js session.json <winSecs> <nWins>
const fs = require('fs');
const { recT0, frames, log } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const WIN = +process.argv[3] || 4.5, N = +process.argv[4] || 4;
const samples = log.filter(s => !s.ev);
const restarts = log.filter(s => s.ev === 'restart').map(s => s.t);
const tEnd = samples[samples.length - 1].t;

// banked chains: chain collapses from high to ~0
const banks = [];
for (let i = 1; i < samples.length; i++) {
  if (samples[i - 1].chain > 600 && samples[i].chain < samples[i - 1].chain * 0.2)
    banks.push({ t: samples[i].t, val: samples[i - 1].chain });
}

function windowScore(t0) {
  const t1 = t0 + WIN;
  if (restarts.some(r => r > t0 - 1.5 && r < t1 + 0.5)) return -1e9;
  const w = samples.filter(s => s.t >= t0 && s.t < t1);
  if (w.length < WIN * 8) return -1e9;
  const first = w[0], last = w[w.length - 1];
  let sc = 0;
  sc += (last.buzz - first.buzz) * 3;        // close shaves
  sc += (last.calls - first.calls) * 6;      // threaded oncoming
  sc += (last.spooks - first.spooks) * 4;    // deer dodges
  sc += (last.kills - first.kills) * 1.2;    // shamblers
  sc += Math.max(...w.map(s => s.mult)) * 1.5;
  const driftT = w.filter(s => s.slip > 0.2 && s.kmh > 90).length / 10;
  sc += driftT * 2;                          // seconds spent properly sideways
  const bank = banks.filter(b => b.t >= t0 && b.t < t1);
  sc += bank.reduce((a, b) => a + Math.min(b.val / 400, 10), 0);
  if (Math.max(...w.map(s => s.kmh)) > 250) sc += 2;
  if (w.some(s => s.tr > 0)) sc += 1;        // oncoming traffic in frame
  return sc;
}

const cands = [];
for (let t = 0; t + WIN <= tEnd; t += 0.5) cands.push({ t0: +t.toFixed(1), sc: windowScore(t) });
cands.sort((a, b) => b.sc - a.sc);
const picked = [];
for (const c of cands) {
  if (c.sc <= 0 || picked.length >= N) break;
  if (picked.every(p => Math.abs(p.t0 - c.t0) >= WIN + 3)) picked.push(c);
}
picked.sort((a, b) => a.t0 - b.t0);
console.log('restarts at:', restarts.map(t => t.toFixed(1)).join(', ') || 'none');
console.log('banked chains:', banks.map(b => b.t.toFixed(1) + 's=' + b.val).join(', ') || 'none');
console.log('picked windows:');
for (const p of picked) {
  const w = samples.filter(s => s.t >= p.t0 && s.t < p.t0 + WIN);
  const first = w[0], last = w[w.length - 1];
  console.log(`  t=${p.t0}s score=${p.sc.toFixed(1)} | vmax=${Math.max(...w.map(s => s.kmh))}km/h ` +
    `multMax=${Math.max(...w.map(s => s.mult))} shaves+${last.buzz - first.buzz} calls+${last.calls - first.calls} ` +
    `dodges+${last.spooks - first.spooks} kills+${last.kills - first.kills} ` +
    `chainMax=${Math.max(...w.map(s => s.chain))} slipMax=${Math.max(...w.map(s => s.slip))}`);
}
fs.writeFileSync('picks.json', JSON.stringify({ WIN, picked, recT0 }));
