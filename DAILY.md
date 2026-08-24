# The daily contract

Every game in this repo is a self-contained `index.html`. There is no shared runtime module and there
must not be one — a game has to keep working when it is opened straight off the disk. So this file is
the contract instead: each game **copies** the helpers below inline, and they agree because they were
copied from here, not because they import from here.

If you change a rule, change it here first, then in every game.

## Storage keys

Keys are flat strings under a per-game slug (the game's directory name), plus one site-wide `kreeda.*`
namespace. Values are pipe-delimited, never JSON, except where a payload genuinely needs it — the format
predates this file, `drift/` already ships it, and a parser you can read in one line is worth more than
generality.

| Key | Value | Meaning |
|---|---|---|
| `<slug>.best` | `12345` | All-time best in the game's endless/free-play mode. Never expires. |
| `<slug>.dbest` | `2026-08-24\|12345` | Today's best in **daily** mode. Stale rows are ignored, not deleted. |
| `<slug>.streak` | `2026-08-24\|4` | Consecutive days this game's daily was completed. |
| `<slug>.settings` | game's own | Sound, difficulty, theme — whatever that game needs to remember. |
| `kreeda.streak` | `2026-08-24\|4` | **Site-wide** streak: consecutive days the player finished *any* daily. |
| `kreeda.daily.<YYYY-MM-DD>` | `drift,carrom` | Which slugs were completed on that date. |

Two rules about reading them:

- **A day-stamped value from another day is worth zero, not stale-but-usable.** `dbest` for yesterday is
  not today's best; it reads as 0. Do not migrate it, do not display it.
- **Every read and every write is wrapped in `try/catch`.** `localStorage` throws outright in Safari
  private mode and on some `file://` origins. A game that can't save must still play.

## The helpers

Copy these verbatim. They are deliberately tiny.

```js
/* ---- Kreeda daily contract — see /DAILY.md. Copied, not imported: the game stays one file. ---- */
const SLUG='chroma-blocks';                     // <-- this game's directory name
function dayKey(d){ d=d||new Date(); const p=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); }
function prevDayKey(k){ const a=k.split('-'), t=new Date(+a[0],+a[1]-1,+a[2]);
  t.setDate(t.getDate()-1); return dayKey(t); }
function daySeed(k){ let h=5381; for(let i=0;i<k.length;i++) h=(h*33 ^ k.charCodeAt(i))|0; return h>>>0; }
function mulberry32(a){ return function(){ a=(a+0x6D2B79F5)|0; let t=Math.imul(a^(a>>>15),1|a);
  t=(t+Math.imul(t^(t>>>7),61|t))^t; return ((t^(t>>>14))>>>0)/4294967296; }; }

const LS={ get:k=>{ try{ return localStorage.getItem(k)||''; }catch(e){ return ''; } },
           set:(k,v)=>{ try{ localStorage.setItem(k,v); }catch(e){} } };

/* a day-stamped value: returns 0 unless the stamp is today */
function loadToday(key){ const s=LS.get(key), i=s.indexOf('|');
  return (i<0 || s.slice(0,i)!==dayKey()) ? 0 : (+s.slice(i+1)||0); }
function saveToday(key,v){ LS.set(key, dayKey()+'|'+Math.round(v)); }

/* consecutive-days counter against one key. Same day = no change; yesterday = +1; older = reset to 1. */
function bumpStreak(key){
  const s=LS.get(key), i=s.indexOf('|'), last=i<0?'':s.slice(0,i), n=i<0?0:(+s.slice(i+1)||0);
  const today=dayKey(), count = last===today ? (n||1) : (last===prevDayKey(today) ? n+1 : 1);
  LS.set(key, today+'|'+count); return count;
}

/* call once when a DAILY run is completed — not on every game over, not in endless mode */
function dailyDone(){
  const today=dayKey(), k='kreeda.daily.'+today;
  const had=LS.get(k).split(',').filter(Boolean);
  if(!had.includes(SLUG)) LS.set(k, had.concat(SLUG).join(','));
  bumpStreak(SLUG+'.streak');
  return bumpStreak('kreeda.streak');            // site-wide, and the number worth showing
}
```

### The seed is the whole point

`daySeed(dayKey())` is a pure function of the calendar date, so **every player worldwide gets the
identical puzzle with no server involved**. That is the only reason any of this works on static hosting.
It follows that:

- Everything that shapes the day's challenge must come from one `mulberry32(daySeed(dayKey()))` stream,
  drawn in a fixed order. A stray `Math.random()` anywhere in daily setup silently desynchronises players
  and there is no way to detect it from inside the game.
- The date is the player's **local** calendar day. Two people in different timezones briefly play
  different dailies; that is the intended trade — a UTC rollover mid-afternoon is worse.
- Daily and endless keep **separate** bests. A road you can learn must never inflate the endless number.

## Sharing a result

The share text is a **spoiler-free block grid**, not a sentence. That shape is what made Wordle spread:
it brags without spoiling, and it pastes intact anywhere Unicode goes.

```
Kreeda · Chroma Blocks · 24 Aug
🟦🟦🟨🟦⬜
🟪🟦🟦🟨🟦
38 lines · streak 4 🔥
kreeda.games/chroma-blocks/
```

Rules, in order of importance:

1. **Never leak the solution.** Blocks encode *how it went*, never *what it was*. A grid that lets a
   reader reconstruct the answer has failed at its only job.
2. First line is `Kreeda · <Game> · <D Mon>`. Last line is the game's URL. Everything between is the
   game's own vocabulary.
3. Squares only — no emoji that render as a different width on Android, and no ZWJ sequences.
4. Include the site-wide streak when it is ≥ 2. It is the number that makes the next day feel owed.
