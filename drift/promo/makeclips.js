// Turn picked highlight windows into ffconcat lists with true per-frame durations.
//   node makeclips.js session.json picks.json <clipSecs>
const fs = require('fs');
const { recT0, frames } = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const { picked } = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const CLIP = +process.argv[4] || 4.4;
// frames[i] are wall-clock epoch seconds; frames[0] lands at log-time recT0
const rel = frames.map(ts => ts - frames[0] + recT0);
picked.forEach((p, ci) => {
  const t0 = p.t0, t1 = t0 + CLIP;
  const idx = [];
  for (let i = 0; i < rel.length; i++) if (rel[i] >= t0 && rel[i] < t1) idx.push(i);
  let out = 'ffconcat version 1.0\n';
  for (let j = 0; j < idx.length; j++) {
    const i = idx[j];
    const dur = j + 1 < idx.length ? rel[idx[j + 1]] - rel[i] : 1 / 25;
    out += `file 'frames/f${String(i).padStart(6, '0')}.jpg'\nduration ${dur.toFixed(4)}\n`;
  }
  // concat demuxer wants the last file repeated to honor the final duration
  out += `file 'frames/f${String(idx[idx.length - 1]).padStart(6, '0')}.jpg'\n`;
  fs.writeFileSync(`clip${ci}.ffconcat`, out);
  console.log(`clip${ci}: ${idx.length} frames, ${(rel[idx[idx.length - 1]] - rel[idx[0]]).toFixed(2)}s from t=${t0}`);
});
