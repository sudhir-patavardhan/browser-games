# Setu — a daily Rāmāyaṇa grid

> **Status: not built.** Setu was implemented and later removed from the collection; this spec is kept
> because it remains the authority on the grid mechanic that Valence, Quanta and Radian are built on. The
> game itself is in git history.

**Slug:** `setu` · **URL:** `kreeda.games/setu/` · **Category:** puzzle · **Tag:** DAILY

A 3×3 grid. Three criteria down the left, three across the top. Each of the nine cells wants the name
of a being from the Rāmāyaṇa who satisfies both — the row's and the column's. Nine names, nine guesses,
one grid a day, the same grid for everybody.

The name is the metaphor and the metaphor is load-bearing. In the Yuddha Kāṇḍa the vānaras build a
causeway to Laṅkā by carrying stones to the water one at a time. Nine stones make a bridge. A grid you
finish is `पूर्ण सेतु` — the bridge is whole; a grid you don't is a bridge with gaps in it, which is
still a thing you built.

This document is the whole design. An implementer should need nothing from the author beyond it, the
data pass described in §5, and the verification list in §12.

---

## 0. Why this game exists

Word-based daily puzzles are saturated to the point of parody. Non-word daily grids are not. The
"Immaculate Grid" shape — a 3×3 where every cell must be filled by something satisfying both its row
and its column — reportedly draws well over 200,000 daily players in American sports, and nobody has
built one in the Rāmāyaṇa / Indian-classical space at all.

Kreeda already has one game in that register: `dasanana/`, a Rāmāyaṇa astra-duel that quotes the
Āditya-Hṛdayam in Devanāgarī and IAST because Agastya teaches it to Rāma at exactly that point in the
Yuddha Kāṇḍa. Setu continues that line. It is not a novelty and it is not a trivia app with a Sanskrit
skin — see §6, which is not boilerplate and should be read before any code is written.

Setu conforms to `/DAILY.md`. Read that first; this spec references it and does not restate it.

---

## 1. The core loop

1. The player opens the page. The day's grid is already generated — no loading state, no spinner, no
   network call of any kind. The six criteria are visible. All nine stones are empty.
2. The player taps a stone. A bottom sheet opens naming both criteria in full and offering a text input.
3. They type a name and submit.
4. One of five things happens (§3.4). If correct, the stone is laid — permanently. There are no takebacks.
5. The grid ends when all nine stones are laid, or when the guess budget is spent.
6. The **reveal panel** opens: every cell, every valid answer, a one-line gloss and a citation for each.
   This is the payload. The puzzle is the excuse.
7. Share (§9), streak (§8), come back tomorrow.

**Guess budget: 9.** Nine guesses for nine cells, exactly as the format demands — a perfect grid is one
where you were never wrong. What consumes a guess is defined precisely in §3.4 and is *narrower* than
you would expect; that narrowness is the difference between a game people play daily and a game people
uninstall.

**Each being may be used once per grid.** Without this rule Hanumān fills four cells and the puzzle is
a shrug. With it, the grid becomes an assignment problem, which is what makes cell order matter and
what makes §4.4 necessary.

---

## 2. Entities and axes

### 2.1 What can be an answer

**v1 answers are named beings only.** Humans, vānaras, rākṣasas, ṛkṣas, birds, nāgas, sages and devas
who appear as characters. Places, mountains, rivers, weapons and astras appear **only as criteria**
("wielded the Brahmāstra", "crossed the ocean to Laṅkā"), never as answers.

This is a deliberate narrowing and it buys a lot. Every criterion family then applies to every entity,
so the generator never has to reason about whether "child of Vāyu" is meaningful for a mountain. It also
keeps the input space one kind of thing, which keeps the typeahead and the disambiguation prompts sane.
An objects-and-places grid is a good v2; see §11.

**Roster size: ~220 beings.** Below roughly 150 the intersections get thin and the generator starts
rejecting most grids; above roughly 300 you are into names that occur once in a list of vānara
chieftains and no honest player could be expected to produce them. 220 is also the largest number one
person can hand-verify against the text and hand-write aliases for in a reasonable pass, which is the
actual binding constraint.

### 2.2 The criterion families

Six families. Each criterion is a predicate over an entity, and every predicate is a lookup against a
tag — never a computation, never a judgement call at runtime.

| Family | Tag | Multi-valued? | Example criteria |
|---|---|---|---|
| `kanda` | `kandas[]` | yes | "Appears in Sundara Kāṇḍa", "Appears in Bāla Kāṇḍa" |
| `class` | `cls` | no | "A vānara", "A rākṣasa", "A ṛṣi" |
| `side` | `side` | no | "Fought for Rāma", "Fought for Laṅkā", "Took neither side" |
| `parent` | `parent` | no | "Child of Vāyu", "Child of Sūrya", "Child of Indra" |
| `line` | `line` | no | "Of the Ikṣvāku line", "Of Pulastya's line", "Of Janaka's house" |
| `deed` | `deeds[]` | yes | "Crossed the ocean", "Carried a message", "Ruled a kingdom", "Bore arms at Laṅkā" |

**The exclusivity rule.** A single-valued family can produce criteria that are mutually exclusive by
construction — nothing is both a vānara and a rākṣasa. Two such criteria facing each other across the
grid guarantee an empty cell.

> **Rule:** two criteria drawn from the same *single-valued* family must never sit on opposite axes.
> They may both sit on the same axis (rows never intersect rows). Multi-valued families are unrestricted.

Legal and good: `rows = {vānara, rākṣasa, human}` × `cols = {Bāla, Araṇya, Yuddha}` — three `class`
criteria, but all on one axis.

Also legal: `rows = {Araṇya, Kiṣkindhā, Sundara}` × `cols = {a vānara, child of Vāyu, carried a message}`.
`class` and `parent` are both single-valued, but they sit on the *same* axis and neither has a partner
facing it.

Illegal: `rows = {a vānara, …}` × `cols = {a rākṣasa, …}` — one cell is empty by construction. The
generator must reject the shape before it even counts cells.

### 2.3 Criterion catalogue

Roughly 45 criteria, each an object:

```js
{ id:'k-sun',
  family:'kanda',
  single:false,                        // is the underlying tag single-valued?
  tier:'core',                         // core | wide | deep — feeds the weekday ramp, §4.5
  label:'Appears in the Sundara Kāṇḍa',       // full form, shown in the cell sheet
  short:'Sundara Kāṇḍa',                      // ≤ 14 chars, shown in the grid header
  dev:'सुन्दरकाण्डम्',                          // Devanāgarī, shown under the short label where the font resolves
  test: e => e.kandas.indexOf('sun') >= 0 }
```

`test` is evaluated exactly once per criterion at boot, to build the bitsets in §4.1. It is never
called during play.

Tiers:

- **`core`** — a criterion any reader of a children's Rāmāyaṇa would understand. The seven kāṇḍas,
  the four classes, the two sides, "child of Vāyu", "bore arms at Laṅkā".
- **`wide`** — needs the epic read once: "of Pulastya's line", "crossed the ocean", "carried a message
  between the two camps", "counselled a king against his course".
- **`deep`** — needs the Vālmīki text specifically: "appears in the Uttara Kāṇḍa", "named in the
  astra-catalogue of the Bāla Kāṇḍa", "ruled a kingdom before the war and after it".

---

## 3. Validation — the hardest problem in the game

A player will type `Hanuman`, `Hanumān`, `हनुमान्`, `Hanumanji`, `Anjaneya`, `Maruti`, `Jai Shri
Hanuman`, and `Hanumn`. All eight are the same being and seven of them are what a real person actually
types. There is no server, no fuzzy-matching service, and no network. Getting this wrong makes the game
infuriating in a way that no amount of good puzzle design recovers from.

### 3.1 The architecture decision

> **The runtime normaliser is deliberately small and conservative. Ambiguity is absorbed by an explicit,
> hand-curated alias list on each entity.**
>
> The normaliser exists so the alias list doesn't have to enumerate diacritic, spacing and
> capitalisation variants. The alias list exists so the normaliser doesn't have to be a linguist.

Every blanket transformation in the normaliser is a rule that fires on *every* name in the roster, so
each one is a collision risk. Every alias fires on exactly one entity, so it is free. When in doubt,
write an alias.

### 3.2 `norm(s)` — the pipeline

Applied identically to player input and to every canonical name and alias at boot. Eleven steps, in this
exact order.

```js
function norm(s){
  if(!s) return '';
  // 1. Devanāgarī → plain ASCII, only if any Devanāgarī is present (§3.3)
  if(/[\u0900-\u097F]/.test(s)) s = devToAscii(s);
  // 2. decompose, then drop every combining mark. This one line folds the whole of IAST.
  s = s.normalize('NFD').replace(/[\u0300-\u036F]/g, '');
  // 3. case
  s = s.toLowerCase();
  // 4. letters only — drops spaces, hyphens, periods, apostrophes, digits, daṇḍas
  s = s.replace(/[^a-z]/g, '');
  // 5. Anglo long vowels
  s = s.replace(/ee/g, 'i').replace(/oo/g, 'u');
  // 6. w → v
  s = s.replace(/w/g, 'v');
  // 7. x → ks   (Laxman)
  s = s.replace(/x/g, 'ks');
  // 8. aspirates and sibilants collapse. Order matters: ksh before sh.
  s = s.replace(/ksh/g, 'ks')
       .replace(/chh?/g, 'c')
       .replace(/sh/g, 's')
       .replace(/kh/g, 'k').replace(/gh/g, 'g').replace(/jh/g, 'j')
       .replace(/th/g, 't').replace(/dh/g, 'd')
       .replace(/ph/g, 'p').replace(/bh/g, 'b');
  // 9. honorifics, post-fold forms, looped (jai shri ram → ram)
  var prev; do { prev = s;
    s = s.replace(/^(sri|jai|jay|lord|svami|bagvan|bagavan|maaraj)/, '')
         .replace(/(ji)$/, '');
  } while (s !== prev && s.length > 2);
  // 10. collapse any run of the same letter (raavan, ravanna, jatayuu)
  s = s.replace(/(.)\1+/g, '$1');
  // 11. drop a single trailing 'a' — Hindi schwa deletion. Ram / Rāma, Lakshman / Lakṣmaṇa.
  s = s.replace(/a$/, '');
  return s;
}
```

**Step 2 is the single most important line in the file, and it is worth understanding why it works.**
Every character in the IAST repertoire is a precomposed Latin letter plus a diacritic, and every one of
them has a canonical NFD decomposition: `ā` → `a` + U+0304, `ś` → `s` + U+0301, `ṇ` → `n` + U+0323,
`ṛ` → `r` + U+0323, `ṁ` → `m` + U+0307, `ṅ` → `n` + U+0307, `ñ` → `n` + U+0303, and likewise
`ṭ ḍ ṣ ḥ ḷ ī ū`. Stripping the U+0300–U+036F block therefore folds the *entire* diacritic problem in one
regex. There is no table to maintain and no character to forget. Do not hand-roll a substitution map;
it will be wrong and it will be longer.

**Worked examples** (input → key):

| Input | Key | Notes |
|---|---|---|
| `Hanumān`, `Hanuman`, `हनुमान्`, `Hanumanji`, `Jai Shri Hanuman` | `hanuman` | |
| `Añjaneya`, `Anjaneya` | `anjaney` | alias of Hanumān |
| `Sugrīva`, `Sugriv`, `Sugreev`, `Sugreeva` | `sugriv` | |
| `Lakṣmaṇa`, `Lakshman`, `Lakshmana`, `Laxman`, `Laxmana` | `laksman` | |
| `Vibhīṣaṇa`, `Vibhishan`, `Vibhishana`, `Vibheeshan` | `vibisan` | |
| `Rāvaṇa`, `Ravan`, `Raavan`, `रावण` | `ravan` | |
| `Śūrpaṇakhā`, `Surpanakha`, `Shurpanakha` | `surpanak` | |
| `Sītā`, `Sita`, `Seeta`, `Seetha` | `sit` | |
| `Mārīca`, `Maricha`, `Mareecha` | `maric` | |
| `Jaṭāyu`, `Jatayu`, `Jathayu` | `jatayu` | `th`→`t` catches the South Indian spelling |

**Where the pipeline is not enough, and an alias is written instead:**

- `Bibhishan` — the Bengali `b`/`v` alternation. A blanket `b`→`v` fold would be a real collision risk
  (`Vāli`/`Bāli` are the same being here, but the fold is one step from other trouble), so it is an
  explicit alias on Vibhīṣaṇa.
- `Kumbhkaran` — the common Hindi spelling drops the interior `a`. `kumbkaran` vs `kumbakarn` is two
  edits and would survive on the fuzzy fallback, but it is far too common a spelling to leave to luck.
  Alias.
- `Ṛśyamūka` typed as `Rishyamuka` — the `ṛ`/`ri`/`ru` alternation is common enough to matter and too
  aggressive to fold at runtime. **Rule: every canonical name containing `ṛ` gets `ri` and `ru` variants
  written into `alt` at authoring time.**
- Every patronymic and epithet in common use: `Rāghava`, `Dāśarathi`, `Jānakī`, `Vaidehī`, `Maithilī`,
  `Māruti`, `Pavanputra`, `Bajrangbali`, `Meghanāda`, `Daśagrīva`, `Laṅkeśa`. These are not spellings;
  they are names, and a player who uses them is demonstrating exactly the knowledge the game is testing.
  Reject one and you have insulted them.

### 3.3 `devToAscii` — Devanāgarī input

Around sixty lines and four tables. The key simplification: **step 2 is going to strip every diacritic
anyway, so the transliterator only ever needs to emit plain ASCII.** It does not need to distinguish
`ष` from `श` from `स` — all three emit `s`. `ण`/`न` → `n`. `ट`/`त` → `t`. `ड`/`द` → `d`. This turns a
hard problem (correct ISO 15919 transliteration) into an easy one.

Algorithm — walk the codepoints, maintaining a pending inherent vowel:

- **Consonant** (क–ह, including nukta forms क़ ज़ ड़ ढ़ फ़): flush any pending vowel, emit the base letter,
  set pending vowel = `a`.
- **Mātrā** (ा ि ी ु ू ृ ॄ े ै ो ौ): replace the pending vowel with that mātrā's ASCII value
  (`a i i u u ri ri e ai o au`).
- **Virāma ्**: cancel the pending vowel.
- **Independent vowel** (अ आ इ ई उ ऊ ऋ ए ऐ ओ औ): flush, emit its ASCII value directly, no pending vowel.
- **Anusvāra ं / candrabindu ँ**: flush, emit `m`.
- **Visarga ः**: flush, emit `h`.
- **Avagraha ऽ, daṇḍa । ॥, ZWJ, ZWNJ, Devanāgarī digits, anything else**: skip. Step 4 would drop them
  regardless, but skipping keeps the intermediate readable when debugging.
- At the end, flush any pending vowel.

`हनुमान्` → `ha`+`nu`+`ma`+`n` → `hanuman`. `रावण` → `ra`+`va`+`na` → `ravana` → step 11 → `ravan`.

**Other Indic scripts are out of scope for v1** (§11). Input containing codepoints from the Tamil,
Telugu, Kannada, Malayalam, Bengali, Gujarati, Gurmukhi or Odia blocks gets a specific, non-punishing
message and **does not cost a guess**:

> "Setu reads Latin letters and Devanāgarī. हनुमान् works; other Indic scripts aren't in yet — sorry.
> Try `Hanuman`."

### 3.4 Resolving a submission

At boot, build `KEYS: Map<string, entityIndex>` from every canonical name and every alias, through
`norm`. Lookup is O(1). Then, on submit:

1. `k = norm(input)`. If `k.length < 2`, ignore silently — the player is mid-typo.
2. **Exact hit** in `KEYS` → that entity.
3. **Miss** → bounded Damerau–Levenshtein fallback over all ~1,400 keys. Threshold by key length:
   `≤4 → 0`, `5–7 → 1`, `≥8 → 2`. At this scale a full scan is a fraction of a millisecond; do not
   build an index.
   - Exactly one candidate within threshold → that entity.
   - **Two or more → do not guess.** Show a disambiguation row of buttons with the canonical IAST names:
     "Did you mean **Kaikeyī** or **Kaikasī**?" This case is real — `kaikeyi` and `kaikasi` are two edits
     apart and are two different women — and silently picking one would be worse than any other failure
     mode in the game. Choosing from the disambiguation row is not itself a guess; it resolves the name,
     and then the rules below apply.
   - Zero candidates → outcome (a).

Then, five outcomes, and **only one of them costs a guess**:

| # | Outcome | Costs a guess? | Feedback |
|---|---|---|---|
| a | Not in the roster | **No** | "Setu doesn't know that name. The roster is ~220 named beings of the Vālmīki Rāmāyaṇa." |
| b | Ambiguous | **No** | The disambiguation row above. |
| c | Already placed in this grid | **No** | "Aṅgada is already laid — row 2, column 1." |
| d | Known, but wrong for this cell | **Yes** | See below. |
| e | Correct | **No** | The stone is laid. |

**Outcome (d) says which half failed.** This is a departure from Immaculate Grid and it is deliberate:

> **Jaṭāyu** — appears in the Araṇya Kāṇḍa ✓ — but is not a vānara ✗

It teaches, it makes the wrong guess feel like it bought something, and it cannot reveal an answer: it
tells the player facts about the being *they* named, not about any being they didn't. A game whose whole
purpose is that people leave knowing something true about the text should not hoard.

**Outcomes (a), (b) and (c) must be free.** A typo, an unknown name and a repeat are the three things a
sincere player does most often. Charging a guess for any of them turns a puzzle into a punishment, and
it is the single most common way this genre gets ruined.

### 3.5 The typeahead, and the trap in it

From two characters, show up to six canonical names as tappable suggestions, ranked prefix-match first,
then substring, then fuzzy. Match against the *normalised* forms so `sug` finds Sugrīva and `hanu` finds
Hanumān.

> **The suggestion list is drawn from the entire roster and is NEVER filtered by what is valid for the
> open cell.** Filtering it would hand over the answer. This is the most seductive bug available in this
> game — it looks like a kindness and it is a spoiler. If an implementer ever writes
> `roster.filter(validForCell)` inside the typeahead, the game is broken.

A **"Recall" toggle** in settings turns the typeahead off entirely, for players who find that
suggestion-scrolling is the whole game. It is recorded in the result and shown in the share line as the
word `recall` (§9). Default: typeahead on.

### 3.6 The build-time collision assertion

At boot, in a self-test in the manner of `dasanana`'s `selfTestMatrix()`: build `KEYS` and
`console.error` on **any** key that two different entities both claim. A collision means the normaliser
has folded two distinct beings together, which silently makes one of them unanswerable. This check costs
nothing and catches the entire class of failure that §3.1's conservatism is designed to prevent.

Also assert, in the same pass, that every entity's canonical IAST name round-trips: `KEYS.get(norm(e.iast)) === e.index`.

---

## 4. Generating the day's grid

Everything below draws from **one** `mulberry32(daySeed(dayKey()))` stream, in a fixed order, per
`/DAILY.md`. A stray `Math.random()` in setup desynchronises the world silently.

### 4.1 Bitsets

At boot, for each criterion, build a bitset of the entity indices satisfying it: a `Uint32Array` of
`ceil(N/32)` words — seven words at N ≈ 220. Cell candidate count is then seven `AND`s and a popcount.
This is why the whole thing fits comfortably in a static file: solvability checking is essentially free,
so the generator can afford to reject grids aggressively.

### 4.2 The determinism rules

These sit alongside `/DAILY.md`'s rule about `Math.random()` and are just as load-bearing:

- The entity table is an **array** with a fixed order. Entity identity in saves and in the alias map is
  the string `id`, never the index; but every *draw* is by index.
- The criterion catalogue is an **array** with a fixed order.
- **Never iterate a `Set`, a `Map` or `Object.keys()` anywhere in daily setup.** Their orders are
  specified in modern engines, but relying on that across a codebase that will be edited is exactly the
  kind of thing that breaks a daily silently three months later.
- `Array.prototype.sort` is stable in every current engine but its *comparator* must be total — never
  return `0` for distinct elements in daily setup. Tie-break on index.

### 4.3 The algorithm

```
rng = mulberry32(daySeed(dayKey()))
pool = criteria filtered by today's tier ramp (§4.5)

for attempt in 0 .. 199:
    rows = draw 3 distinct criteria from pool via rng
    cols = draw 3 distinct criteria from pool via rng, none equal to a row
    if not axisRuleOK(rows, cols):  continue        # §2.2 exclusivity
    cellBits[i][j] = rowBits[i] & colBits[j]
    n[i][j]        = popcount(cellBits[i][j])
    if min(n) < 3:                  continue        # §4.4
    if sum(n) < 40 or sum(n) > 110: continue        # breadth band
    if not everyCellHasAFamousAnswer(cellBits):     continue   # §4.5
    if not perfectMatchingExists(cellBits):         continue   # §4.4
    accept
else:
    use FALLBACK[ daySeed(dayKey()) % FALLBACK.length ]
```

`FALLBACK` is **30 hand-built, hand-verified grids** shipped in the file. They exist so that a data edit
that accidentally narrows the roster can never produce a day with no puzzle. If the audit (§4.6) ever
reports a fallback being used in the next 365 days, that is a bug to fix in the data, not a shrug.

### 4.4 Solvable means *actually* solvable

Two separate requirements, and the second is the one implementations get wrong.

**(a) Every cell has at least three valid answers.** Not one. A cell with a single answer is a trivia
question wearing a puzzle's clothes, and it is also the cell most likely to be *wrong* — a single-answer
cell is one data error away from being unanswerable, with no redundancy to absorb the mistake. Three is
the floor.

**(b) A system of distinct representatives must exist.** Because each being may be used once, per-cell
non-emptiness does **not** imply the grid is solvable. Three cells whose only candidates are the same
three beings, plus a fourth cell that also needs one of them, is an unsolvable grid in which every cell
individually looks fine.

So: run a bipartite matching between the 9 cells and the entities, and require a **perfect matching of
size 9**. Kuhn's augmenting-path algorithm is about thirty lines and runs in microseconds at 9 × 220.
Do not skip it, do not approximate it, and do not assume that `min(n) ≥ 3` implies it — it does not.

### 4.5 Keeping difficulty even

Three mechanisms, all pure functions of the date.

**Fame.** Every entity carries `fame` 1–5, assigned by hand when the row is written:

| fame | Meaning | Examples |
|---|---|---|
| 5 | Any Indian child knows the name | Rāma, Sītā, Hanumān, Rāvaṇa, Lakṣmaṇa |
| 4 | Anyone who knows the story | Vibhīṣaṇa, Sugrīva, Jaṭāyu, Kumbhakarṇa, Bharata, Daśaratha |
| 3 | Read the epic once | Aṅgada, Jāmbavān, Śabarī, Mandodarī, Tārā, Mārīca, Viśvāmitra |
| 2 | Read it attentively | Trijaṭā, Sampāti, Guha, Sumantra, Surasā, Nala, Nīla |
| 1 | Knows the Vālmīki text | Śatabali, Kuśadhvaja, Suṣeṇa, Lavaṇāsura |

**Every cell must contain at least one answer with `fame ≥ 3`.** No cell is ever solvable only by a
specialist. This is the check `everyCellHasAFamousAnswer` above and it does more for perceived fairness
than anything else in this section.

**The breadth band** (`40 ≤ sum(n) ≤ 110`) keeps the total answer space from collapsing or ballooning.

**The weekday ramp.** `pool` is filtered by tier as a function of the local weekday of `dayKey()` — which
is the same everywhere for a given `dayKey`, so it stays deterministic:

| Day | Criterion tiers in the pool |
|---|---|
| Mon, Tue | `core` |
| Wed, Thu | `core`, `wide` |
| Fri, Sat | `core`, `wide`, one criterion may be `deep` |
| Sun | `core`, `wide`, `deep` |

Monday should feel like an invitation. Sunday should feel like the reason you learned the names.

### 4.6 The audit mode

A dev-only query parameter, not linked from anywhere:

- **`?date=YYYY-MM-DD`** — render that day's grid instead of today's. No streak, no `dbest` write.
- **`?audit=365`** — generate the next 365 days and dump to the console: any day that fell back, the
  min/max/mean cell counts, the distribution of `hardness` (§7), the criteria that never appear and the
  ones that appear more than 5% of the time, and the count of days where the same criterion lands twice
  in one week.

Run the audit before every data change ships. It is the only way to actually know that difficulty is
even, as opposed to intending that it be.

---

## 5. The data

Shipped as a JS literal inside the single HTML file. Roughly 220 entities at ~300 bytes each ≈ 65 KB
before gzip, which is fine; `drift/index.html` is already 4,300 lines.

### 5.1 Entity schema

```js
// Every field required except `note` and `ref`.
{ id:      'hanuman',            // stable slug. Saves store these. NEVER renumber or rename.
  iast:    'Hanumān',            // canonical display name, IAST with full diacritics
  dev:     'हनुमान्',              // Devanāgarī display, '' if genuinely unattested
  gloss:   'The vānara who leapt the ocean, found Sītā in the aśoka grove, and burned Laṅkā.',
  cls:     'vanara',             // manusa | vanara | raksasa | rksa | paksin | naga | rsi | deva | other
  side:    'rama',               // rama | lanka | turned | none
  kandas:  ['kis','sun','yud'],  // bala | ayo | ara | kis | sun | yud | utt
  parent:  'vayu',               // vayu|surya|indra|agni|brahma|visvakarma|varuna|yama|kubera|''  ('' = none/unstated)
  line:    '',                   // iksvaku | pulastya | videha | ''
  deeds:   ['ocean','duta','lanka-war','burned-lanka','sanjivani'],   // closed vocabulary, §5.2
  fame:    5,                    // 1..5, §4.5
  tier:    'core',               // core | wide | deep — gates which criteria this entity can be needed for
  src:     'V',                  // V | V-utt | V? | R   — §5.4
  ref:     'Sundara Kāṇḍa 1; Yuddha Kāṇḍa 74',   // sarga-level citation for the reveal panel
  alt:     ['Hanuman','Hanumat','Hanumanta','Hanumantha','Anjaneya','Anjaneyar','Maruti','Maruthi',
            'Marutinandan','Pavanputra','Pavansut','Vayuputra','Kesarinandan','Bajrangbali',
            'Anuman','हनुमान','आञ्जनेय','मारुति'] }
```

Notes on fields:

- **`id`** is the save format. Once shipped it is frozen. If a being turns out to be misidentified, the
  fix is a new `id` and the old one retired, never a rename.
- **`alt`** carries a handful of Devanāgarī forms even though `devToAscii` should make them redundant.
  They are cheap and they double as live test cases for the transliterator.
- **`dev`** is display only. It is never matched against and never used for validation.
- **`ref`** is a citation, not a link. No network.

### 5.2 The `deeds` vocabulary

Closed. Roughly 20 values; adding one is a data-model change, not a data edit.

`ocean` (crossed the ocean to Laṅkā) · `duta` (carried a message between the camps) ·
`lanka-war` (bore arms at Laṅkā) · `burned-lanka` · `sanjivani` (part of the herb-mountain episode) ·
`setu` (worked on the causeway) · `ruled` (ruled a kingdom at some point in the narrative) ·
`exile-companion` (went into the forest with Rāma) · `counsel` (counselled a king against his course) ·
`boon` (received a boon from a deva) · `curse` (bore a curse) · `ascetic` (lived as an ascetic) ·
`astra` (wielded a named astra) · `search-party` (sent out to search for Sītā) ·
`svayamvara` (present at Mithilā) · `disguise` (took another form) · `first-meeting` (met Rāma in the
forest) · `bird` (of Aruṇa's line) · `physician` · `minister`.

### 5.3 Ten real entries

Written out in full, to fix the register and the level of care expected. These are not placeholders.

```js
const BEINGS = [
{ id:'rama', iast:'Rāma', dev:'राम',
  gloss:'Eldest son of Daśaratha of Ayodhyā; exiled fourteen years; the epic is named for him.',
  cls:'manusa', side:'rama', kandas:['bala','ayo','ara','kis','sun','yud','utt'],
  parent:'', line:'iksvaku', deeds:['exile-companion','astra','lanka-war','svayamvara','first-meeting','ruled'],
  fame:5, tier:'core', src:'V', ref:'throughout',
  alt:['Rama','Ram','Raama','Raghava','Raghav','Ramachandra','Ramchandra','Dasharathi','Dasarathi',
       'Kakutstha','Ramar','राम','रामचन्द्र'] },

{ id:'sita', iast:'Sītā', dev:'सीता',
  gloss:'Daughter of Janaka of Videha, found in a furrow; wife of Rāma; held in the aśoka grove at Laṅkā.',
  cls:'manusa', side:'rama', kandas:['bala','ayo','ara','sun','yud','utt'],
  parent:'', line:'videha', deeds:['exile-companion','svayamvara'],
  fame:5, tier:'core', src:'V', ref:'Bāla Kāṇḍa 66; Sundara Kāṇḍa 14–21',
  alt:['Sita','Seeta','Seetha','Sitha','Janaki','Jaanaki','Vaidehi','Maithili','Bhumija','सीता','जानकी'] },

{ id:'lakshmana', iast:'Lakṣmaṇa', dev:'लक्ष्मण',
  gloss:'Son of Daśaratha and Sumitrā; followed Rāma into exile; killed Indrajit at Laṅkā.',
  cls:'manusa', side:'rama', kandas:['bala','ayo','ara','kis','yud','utt'],
  parent:'', line:'iksvaku', deeds:['exile-companion','astra','lanka-war','svayamvara','sanjivani'],
  fame:5, tier:'core', src:'V', ref:'Yuddha Kāṇḍa 90',
  alt:['Lakshmana','Lakshman','Laxman','Laxmana','Lakshaman','Saumitri','Soumitri','लक्ष्मण'] },

{ id:'hanuman', iast:'Hanumān', dev:'हनुमान्',
  gloss:'Son of Vāyu and Añjanā; minister to Sugrīva; leapt the ocean, found Sītā, and burned Laṅkā.',
  cls:'vanara', side:'rama', kandas:['kis','sun','yud','utt'],
  parent:'vayu', line:'', deeds:['ocean','duta','lanka-war','burned-lanka','sanjivani','search-party','disguise'],
  fame:5, tier:'core', src:'V', ref:'Sundara Kāṇḍa 1; Yuddha Kāṇḍa 74',
  alt:['Hanuman','Hanumat','Hanumanta','Hanumantha','Anjaneya','Anjaneyar','Maruti','Maruthi',
       'Marutinandan','Pavanputra','Pavansut','Vayuputra','Kesarinandan','Bajrangbali','Anuman',
       'हनुमान','आञ्जनेय','मारुति'] },

{ id:'sugriva', iast:'Sugrīva', dev:'सुग्रीव',
  gloss:'Son of Sūrya; younger brother of Vāli; king of Kiṣkindhā after Vāli\'s death; allied with Rāma.',
  cls:'vanara', side:'rama', kandas:['kis','sun','yud','utt'],
  parent:'surya', line:'', deeds:['ruled','lanka-war','search-party','counsel'],
  fame:4, tier:'core', src:'V', ref:'Kiṣkindhā Kāṇḍa 5 (the pact by fire)',
  alt:['Sugriva','Sugriv','Sugreev','Sugreeva','सुग्रीव'] },

{ id:'vali', iast:'Vāli', dev:'वालि',
  gloss:'Son of Indra; king of Kiṣkindhā; elder brother of Sugrīva; killed by Rāma\'s arrow.',
  cls:'vanara', side:'none', kandas:['kis','utt'],
  parent:'indra', line:'', deeds:['ruled','boon'],
  fame:4, tier:'core', src:'V', ref:'Kiṣkindhā Kāṇḍa 16–18',
  alt:['Vali','Bali','Baali','Vaali','वालि','बालि'] },

{ id:'angada', iast:'Aṅgada', dev:'अङ्गद',
  gloss:'Son of Vāli and Tārā; heir of Kiṣkindhā; led the southern search party; envoy to Rāvaṇa\'s court.',
  cls:'vanara', side:'rama', kandas:['kis','sun','yud'],
  parent:'', line:'', deeds:['search-party','duta','lanka-war','setu'],
  fame:3, tier:'core', src:'V', ref:'Kiṣkindhā Kāṇḍa 54; Yuddha Kāṇḍa 41',
  alt:['Angada','Angad','Angadha','अङ्गद','अंगद'] },

{ id:'jatayu', iast:'Jaṭāyu', dev:'जटायु',
  gloss:'Vulture king of Aruṇa\'s line; friend of Daśaratha; fought Rāvaṇa over Sītā and died of his wounds.',
  cls:'paksin', side:'rama', kandas:['ara'],
  parent:'', line:'', deeds:['bird','first-meeting'],
  fame:4, tier:'core', src:'V', ref:'Araṇya Kāṇḍa 50–68',
  alt:['Jatayu','Jatayus','Jathayu','Jataayu','जटायु'] },

{ id:'ravana', iast:'Rāvaṇa', dev:'रावण',
  gloss:'Ten-headed king of Laṅkā; son of Viśravas and Kaikasī; grandson of Pulastya; Vedic scholar, '
       +'Śiva-devotee, and the epic\'s antagonist.',
  cls:'raksasa', side:'lanka', kandas:['ara','sun','yud','utt'],
  parent:'', line:'pulastya', deeds:['ruled','boon','lanka-war','astra','disguise'],
  fame:5, tier:'core', src:'V', ref:'Araṇya Kāṇḍa 46; Yuddha Kāṇḍa 108',
  alt:['Ravana','Ravan','Raavan','Raavana','Dashagriva','Dasagriva','Dashanana','Dasanana','Lankesh',
       'Lankeshwar','Ravanan','रावण','दशग्रीव'] },

{ id:'trijata', iast:'Trijaṭā', dev:'त्रिजटा',
  gloss:'Rākṣasī of the aśoka grove who dreamt of Rāvaṇa\'s fall and comforted Sītā through her captivity.',
  cls:'raksasa', side:'lanka', kandas:['sun','yud'],
  parent:'', line:'', deeds:['counsel'],
  fame:2, tier:'wide', src:'V', ref:'Sundara Kāṇḍa 27 (the dream)',
  alt:['Trijata','Trijatha','Thrijata','त्रिजटा'] }
];
```

### 5.4 Sourcing

**The spine is the Vālmīki Rāmāyaṇa.** Where the Baroda critical edition and the vulgate differ, the
critical edition governs. Working texts: `valmikiramayan.net` and `sanskritdocuments.org` for the Sanskrit
with sarga numbering, and any of the standard English translations for the gloss. Citations are recorded
per entity in `ref` at sarga level.

`src` values:

- **`V`** — attested in the Vālmīki text outside the Uttara Kāṇḍa.
- **`V-utt`** — attested only in the Uttara Kāṇḍa. Included, but see below.
- **`V?`** — attested in some recensions of Vālmīki and not others, or the attestation is disputed.
  **Never used as the basis of a criterion.** Reveal-panel material only.
- **`R`** — regional tellings only. **Not in the roster for v1.**

**The Uttara Kāṇḍa is included and flagged.** It is widely held by scholars to be a later addition, as is
much of the Bāla Kāṇḍa. Consequence in the game: the criterion "Appears in the Uttara Kāṇḍa" is
`tier:'deep'`, so it only shows up on Fridays through Sundays, and the reveal panel carries one plain
line saying so. The game does not take a position beyond reporting the scholarly view.

### 5.5 Contested facts

> **Rule: the grid never asks a question whose answer differs between the major tellings.**

A fact that Kamba Rāmāyaṇam, Rāmcaritmānas, Adhyātma Rāmāyaṇa, the Jain Paumacariya or the Southeast
Asian tellings (Ramakien, Hikayat Seri Rama) contradict is marked `contested` and is **never used as a
criterion**. It may still appear in a reveal-panel gloss, with the disagreement stated — because the
disagreement is more interesting than the fact.

Four worked examples, each verified while writing this spec:

1. **Who kills Rāvaṇa.** Vālmīki: Rāma. The Jain Paumacariya of Vimalasūri has **Lakṣmaṇa** kill him,
   because a Jain Rāma has renounced killing. → "killed Rāvaṇa" is not a criterion. "Bore arms at Laṅkā"
   is uncontested and is.
2. **Whether Sītā was ever in Rāvaṇa's presence.** The Adhyātma Rāmāyaṇa (c. 14th c., transmitted within
   the Brahmāṇḍa Purāṇa) has Rāma give Sītā into Agni's keeping and a **Māyā Sītā** abducted in her place.
   Kamban has Rāvaṇa lift the ground she stands on rather than touch her. → any criterion phrased around
   the abduction as a physical act is out; Sītā's `deeds` carry no abduction tag at all.
3. **The Lakṣmaṇa-rekhā.** Not in Vālmīki. Not in Tulsīdās's Rāmcaritmānas as a drawn line either, though
   Mandodarī alludes to a line in the Laṅkā Kāṇḍa. It enters through medieval regional retellings —
   the Bengali Kṛttivāsī Rāmāyaṇa among them. → never asserted anywhere in the game, and named in the
   reveal panel's notes as an example of what Setu deliberately does not claim.
4. **Tārā's parentage.** Vālmīki describes her as the daughter of the vānara physician **Suṣeṇa**; later
   sources make her an **apsarā** risen from the churning of the ocean. → Tārā's `parent` is `''`, and
   the gloss states both. This is the ideal shape of a contested entry: the game is *richer* for saying
   "the tellings disagree, and here is how" than it would be for picking one.

---

## 6. Respect

This is living scripture for hundreds of millions of people. It is not trivia set-dressing, and the fact
that the mechanic came from a baseball game does not license treating it like one.

**Setu is a game about a text, not about faith.** Every criterion is a statement about what a named
recension says, checkable by opening it. Nothing asks a player to rank, judge, wager on, or have an
opinion about the divine.

### Out of bounds, explicitly

- **No criterion about divinity, avatārhood, or moral standing.** No "who was in the right" axis, no
  "who is an avatāra of Viṣṇu" axis, nothing that turns a theological claim into a cell.
- **No figures.** No rendered image, illustration, avatar, sprite or emoji standing for Rāma, Sītā,
  Hanumān, Rāvaṇa or any deity. Daśānana draws figures because it is a battle scene in the epic's own
  idiom; a grid puzzle with a cartoon Hanumān in a cell is a different and worse thing. Cells hold text
  and, at most, a small geometric sigil that stands for nothing.
- **Three episodes are out of bounds as puzzle material**: the Agni-parīkṣā, Sītā's exile in the Uttara
  Kāṇḍa, and the killing of Śambūka. These are the passages under live, painful contest — including in
  caste politics — and turning any of them into a fill-the-cell answer would be cheap. They are named in
  neutral language in the reveal panel where a listed being touches them, with no scoring attached and
  no question asked.
- **Nothing modern.** No Ayodhyā site dispute, no political use of the epic, no "map of Rāma's India",
  no dating claims, no identification of narrative places with modern towns.
- **No monetisation inside the game surface.** No ads on the play screen, no gacha, no "collect
  Hanumān", no leaderboard ranking anyone by anything resembling devotion.
- **No Sanskrit as decoration.** Devanāgarī appears only where it is an actual name or an actual quoted
  line — never as texture behind a button, never as a background watermark. Daśānana quotes the
  Āditya-Hṛdayam because Agastya teaches it to Rāma at that exact moment in the Yuddha Kāṇḍa; the same
  standard applies here.

### Register

Names are given in full and correctly, with diacritics: the interface says **Vibhīṣaṇa**, not "Vibhi".
Honorifics are not used in cell labels — the data model can't carry them consistently — but the reveal
panel's prose is respectful third-person throughout. **No jokes at any character's expense, including
Rāvaṇa's**, who is a Brahmin scholar, a Śiva-devotee and a vīṇā player as well as the antagonist, and
whom Kamban treats as a tragic figure. Kumbhakarṇa's sleep is not a punchline.

### The reveal panel is the point

Every ending — 9/9 or 2/9 — shows every valid answer for every cell with a gloss and a citation. A player
who fails completely still leaves having read something true about the text. **If the game ever has to
choose between a better puzzle and a truer gloss, the gloss wins.**

### A correction path

A visible "Something wrong here?" line at the foot of the reveal panel, opening a GitHub issue URL or a
`mailto:`. Errors in this dataset are not like errors in a sports dataset: they should be easy to report
and fast to fix. There is no backend, so a correction ships as a new version of the file — which is
fine, because the file is the whole game.

---

## 7. Scoring

### 7.1 What is reported

- **Stones laid**, 0–9. The headline number, exactly as the format demands.
- **Guesses spent**, 0–9.
- **Weight**, 0–45 — the rarity substitute.

### 7.2 Weight

Each stone you lay has a weight: `6 − fame(entity)`. A stone laid with Hanumān (fame 5) weighs 1; a stone
laid with Śatabali (fame 1) weighs 5. Sum over the laid stones. Maximum possible is 45.

Alongside it, the game shows **today's heaviest possible bridge** — the maximum total weight over all
perfect matchings of the grid. Computed once at generation time by the same augmenting-path matcher as
§4.4, extended to maximum cost, over the twelve rarest candidates per cell. Restricting the candidate
list can only understate the optimum, never overstate it, so the displayed target is always actually
achievable.

> Your bridge weighed **27**. Today's heaviest weighed **38**.

Laying every stone at the heaviest available weight is the **perfect bridge** — rare, entirely
determined by the day's grid, and worth calling out on the end screen.

### 7.3 Honesty about what Weight is not

State this in the game, in the reveal panel, in about this many words:

> **This is not rarity scoring.** Immaculate Grid's rarity is a *social* measurement: it tells you how few
> of the other two hundred thousand players thought of your answer, and knowing that requires a server
> counting everybody. Setu has no server and never phones home. Its Weight is an *editorial* measurement
> — a number the author assigned to each being when the dataset was written, reflecting roughly how
> well-known that being is in the tradition. It is a stable judgement about the text, not a live
> measurement of the crowd.
>
> It has one property the real thing lacks: it is the same on day one as on day one thousand, and it
> works on a plane. It lacks one the real thing has: it can never surprise you by revealing that
> everyone else also thought of Jāmbavān.

Do not call it "rarity" anywhere in the interface. Call it Weight.

### 7.4 What gets stored

Per `/DAILY.md`, flat strings, pipe-delimited, every read and write in `try/catch`.

| Key | Value | Meaning |
|---|---|---|
| `setu.dbest` | `2026-08-24|27` | Today's Weight. Stale stamp reads as 0. |
| `setu.best` | `41` | Best Weight in **practice** mode only. Never touched by the daily. |
| `setu.streak` | `2026-08-24|4` | Consecutive days this game's daily was completed. |
| `setu.state` | `2026-08-24|hanuman,,angada,,,jatayu,,,|3|0` | In-progress grid: nine ids (blank = empty), guesses spent, done flag. |
| `setu.settings` | `snd=1;drone=0;dev=1;type=1;theme=auto` | Sound, drone, Devanāgarī, typeahead, theme. |
| `kreeda.streak`, `kreeda.daily.<date>` | per `/DAILY.md` | Site-wide. |

`setu.state` exists so that closing the tab doesn't lose the grid. It stores only the stones already laid,
which the player already knows; empty cells stay empty. (The grid itself is derivable from the page
source by anyone who wants to, as with every seeded daily in this repo; `/DAILY.md` accepts that trade.)

`dailyDone()` is called **when the grid ends, either way** — 9/9 or out of guesses. A streak that
requires a perfect grid would break for everybody in the first week and then mean nothing. Showing up is
the feat the streak pays for.

---

## 8. The end of a grid

**At 9/9.** `पूर्ण सेतु` — the bridge is whole. A short, sober celebration: on a small canvas strip under
the grid, nine stones settle into a causeway across the strait, left to right, one every 120 ms; a single
conch (Daśānana's `AudioEngine.conch()`); the line from the Yuddha Kāṇḍa about the vānaras carrying
stones to the water. Then the reveal panel. **No confetti, no fireworks, no fanfare.**

**Out of guesses.** The unlaid stones stay open water. "Five stones stand. The bridge waits." Then the
same reveal panel, with the same completeness — a player who got two cells needs the answers *more*.

**The reveal panel**, in both cases: nine sections, one per cell, each headed by its two criteria and
listing every valid answer as `IAST · Devanāgarī · gloss · citation`, with the player's own answer marked
and its weight shown. Then the source note (§5.4), the contested-facts note where the day's grid touched
one, and the correction link.

**Practice mode.** A separate entry point, grid seeded from `Math.random()`, unlimited plays. Writes
`setu.best` only. Never writes `setu.dbest`, never calls `dailyDone()`, never shares with a streak line.

**Archive.** A date picker back to launch. Trivially available, since the grid is a pure function of the
date. Archive grids are marked "Archive" in the header, are ephemeral (no `setu.state` row), write
nothing, and share without a streak line.

---

## 9. Sharing

Per `/DAILY.md`. Nine squares is a natural fit for this format — better than any other game in the repo.

**The vocabulary is exactly three glyphs:**

| Glyph | Meaning |
|---|---|
| 🟧 | Stone laid with no wrong guess spent on that cell |
| 🟨 | Stone laid after one or more wrong guesses on that cell |
| ⬜ | Open water — cell not solved |

All three are squares of identical width with no ZWJ sequences, per `/DAILY.md` rule 3. `⬜` rather than
`⬛` because `⬛` disappears against a dark chat background.

```
Kreeda · Setu · 24 Aug
🟧🟧🟨
⬜🟧🟧
🟨🟧🟧
8/9 · weight 27 · streak 4 🔥
kreeda.games/setu/
```

With the typeahead off, the score line reads `8/9 · weight 27 · recall · streak 4 🔥`. The streak clause
appears only when the site-wide streak is ≥ 2.

**No Devanāgarī in the share string.** It breaks in some SMS clients, it renders as tofu on machines
without the font, and a block of Devanāgarī pasted into a group chat reads like a religious posting
rather than a game result. Latin only.

### It cannot leak the answers — the argument, not just the claim

The block grid encodes, per cell, exactly two bits: *solved or not*, and *cleanly or not*. It encodes
nothing about *which being* was named. The criteria themselves are not secret — every player worldwide
sees the identical six criteria the moment they open the page — so revealing which cells a given player
found tells a reader nothing they could not already see. Cell difficulty is common knowledge.

**Therefore: do not encode Weight per cell.** A per-cell rarity glyph would leak. Telling a reader that
your answer to a three-answer cell was fame-1 narrows their search to one being. Weight appears **only**
as a single total on the score line, where it is not attributable to any cell. This is the one way this
share format could be broken, and it is exactly the kind of feature that looks like a nice idea in
review. It isn't.

---

## 10. Presentation

### 10.1 Visual idiom

Daśānana's palette is a dawn over a battlefield — sky `#8ed4ff` into `#ffd27a`, ink `#3a2208`, saffron
and amber accents, cream panels with a `rgba(178,122,32,.55)` rule and 16 px radii. Setu is the same
family turned toward the sea: the strait at dawn, the nine stones lying on the water.

```css
--sea-deep:#0b3a4a;  --sea:#12586c;   --foam:rgba(255,255,255,.14);
--sky-hi:#6ec6ff;    --sky-lo:#ffd27a;
--stone:#f6efdd;     --stone-set:#ffe2a8;  --stone-rule:rgba(178,122,32,.5);
--ink:#2a1a0a;       --ink-dim:#6a5232;
--amber:#ff8a1e;     --gold:#ffb62e;
```

Dark mode is the same strait at dusk: `--sea-deep:#04202a`, stones `#2a2418` with warm ink. Respect
`prefers-color-scheme`, and offer a three-state toggle (auto/light/dark) in `setu.settings`.

An empty stone is `--stone` with a hairline rule. A laid stone is `--stone-set`, carries the being's IAST
name at 13 px and its Devanāgarī at 11 px beneath, and gets a **filled corner notch** — because correct
and incorrect must never be conveyed by colour alone.

**Root site card**: dark surface per the site's conventions, category `puzzle`, tag `DAILY`, an 8:3
inline-SVG thumbnail of nine stones stepping across a strait at dawn with three of them lit. Hand-drawn
SVG, no image file, consistent with every other card in `index.html`.

### 10.2 Audio

Reuse Daśānana's `AudioEngine` shape — WebAudio oscillators only, no audio files, because the game must
work opened straight off the disk.

- **Stone laid**: two short sine bursts a fifth apart, ~90 ms total, over a low thud. A struck stone.
- **Wrong**: one damped low tone, 180 ms. No buzzer, no cartoon descent.
- **Last guess spent**: the ambient bed drops a semitone.
- **9/9**: `conch()`, once.
- **Ambient drone**: Daśānana's tānpūra-ish two-detuned-oscillators-plus-a-fifth through a lowpass,
  very quiet. **Off by default** — a puzzle you sit and think over should not hum at you.

Defaults: sound on, drone off, both in `setu.settings`, both toggleable from the play screen.

### 10.3 Devanāgarī, IAST, and the font problem

**IAST is primary; Devanāgarī is a secondary line beneath it.** Every character IAST uses lives in Latin
Extended Additional and is covered by every default UI font shipped in the last fifteen years, on every
platform. It needs no help and it is the form the player types. Devanāgarī needs help.

The site ships **no webfont** — `index.html` says so in a comment, and games must work offline, so
downloading Noto Sans Devanagari is not available. Therefore, on a `.dev` class only:

```css
.dev{ font-family:"Noto Sans Devanagari","Nirmala UI","Kohinoor Devanagari",
      "Devanagari Sangam MN","Mangal","Samanata","Lohit Devanagari",sans-serif; }
```

That stack covers macOS and iOS (Devanagari Sangam MN, Kohinoor), Windows (Nirmala UI since 8, Mangal
since XP), Android (Noto Sans Devanagari has shipped since 4.x) and most Linux desktops.

**Then detect the failure, because some machines still have nothing.** At boot, measure `क` in the
Devanāgarī stack and in a guaranteed-fallback family with `ctx.measureText` on an offscreen canvas. If
the two widths agree within 0.5 px, the stack is not resolving and the browser is about to draw tofu
boxes. Set `document.documentElement.dataset.dev = 'off'`, and a single CSS rule hides every `.dev`
element. **A player must never see a row of boxes where a name should be.** IAST alone is complete and
correct on its own; the Devanāgarī is enrichment.

A settings toggle also turns Devanāgarī off manually, for anyone who finds the double line noisy.

### 10.4 Mobile-first layout

Portrait phone is the design target; everything else is a relaxation of it.

- The grid is a 4×4 CSS grid: a corner cell, three column headers across the top, three row headers down
  the left, nine stones. `width: min(94vw, 420px)`, `aspect-ratio: 1`.
- On a 390 px screen that leaves about 90 px per column header. **This is why every criterion carries a
  `short` label of ≤ 14 characters.** Short goes in the header at 11 px, wrapping to at most two lines
  (three for row headers, which get 74 px of width). Full label appears in the cell sheet and on tapping
  the header. Give headers a fixed `min-height` so the grid does not reflow when the day changes.
- **Tapping a stone opens a bottom sheet, not an inline input.** A text field inside a 100 px cell loses
  a fight with the mobile keyboard every time. The sheet carries: both criteria in full, the guesses
  remaining, one text input, the typeahead list, and Cancel.
- The input:
  `autocapitalize="words" autocorrect="off" autocomplete="off" spellcheck="false" inputmode="text" enterkeyhint="go"`.
  **`autocorrect="off"` is not optional** — iOS will cheerfully turn `Sugriva` into `Sugar iva` and the
  player will blame the game.
- Anchor the sheet above the keyboard using `visualViewport.height`, with `env(safe-area-inset-bottom)`
  padding underneath.
- Desktop and landscape: same grid, capped at 520 px; the sheet becomes a centred modal.

### 10.5 The free hint

Each stone carries a small `ⓘ`. Tapping it shows **how many beings in the roster fit that cell** —
"7 beings fit here." Free, unlimited, doesn't leak a name, and genuinely useful: it tells you where to
start. A hint that reveals a *letter* is out of scope (§11); on a three-answer cell it would give the
answer away.

### 10.6 Accessibility

- The grid is `role="grid"` with `role="row"` and `role="gridcell"`, and `aria-rowindex`/`aria-colindex`.
  **Each cell's `aria-label` names both criteria in full**, because the visual header association is not
  otherwise conveyed: *"Row: appears in the Sundara Kāṇḍa. Column: a vānara. Empty."* → *"…Laid with
  Hanumān."*
- Full keyboard operation: arrow keys move focus between stones, Enter opens the sheet, Escape closes it,
  Tab walks the typeahead, Enter submits.
- Every text-on-background pair ≥ 4.5:1. Ink `#2a1a0a` on stone `#ffe2a8` is about 13:1.
- **State is never colour-only.** A laid stone has a corner notch and a name in it; a wrong guess shows a
  struck counter and an inline message; the guess budget is a number, not a colour.
- `prefers-reduced-motion`: the bridge animation collapses to one cross-fade, the sea stops moving.
- Touch targets ≥ 44 px throughout; stones are around 110 px.
- `lang="sa"` on Devanāgarī spans and `lang="sa-Latn"` on IAST spans, so screen readers do not read
  *Hanumān* with English phonetics.
- Live region on the result message so submissions are announced.

---

## 11. Out of scope for v1

State these in the repo, not just in someone's head:

- **Places, weapons, mountains, rivers and astras as answers.** They stay criteria-side. A second entity
  table with its own axes is the obvious v2 and it changes the generator, so it is not a v1 stretch goal.
- **Indic scripts other than Devanāgarī** for input. Tamil in particular is a strong v2 candidate given
  where Kamban's audience is, but each script is a table and a test pass.
- **UI localisation** into Hindi, Tamil or Telugu. Every criterion label would need translation and
  vetting, and a half-done localisation of scriptural material is worse than none.
- **Any entity outside the Rāmāyaṇa.** No Mahābhārata, no Purāṇic crossovers, however tempting Kubera or
  Śiva may be as cells.
- **Anything networked.** No accounts, no leaderboards, no multiplayer, no analytics beyond whatever
  `analytics.js` already does at the site level, no telemetry from inside the game.
- **True rarity scoring.** Structurally impossible without a server; §7.3 is the substitute and says so.
- **Recorded audio.** No narration, no chanting, no sampled instruments. Oscillators only.
- **Images of any character.** Permanent, not v1-only. See §6.
- **Letter-revealing hints.** The count hint (§10.5) is in; a letter hint is out.
- **Grids other than 3×3.** 4×4 needs a roster twice the size to keep `min(n) ≥ 3`.
- **A "share your answers" mode.** Tempting, and it is the one thing that would break §9's guarantee.

---

## 12. Verify before shipping

Facts stated in this document that were checked against sources while writing it, and can be relied on:

- The four herbs of the Yuddha Kāṇḍa are **mṛtasañjīvanī, viśalyakaraṇī, sauvarṇakaraṇī** and
  **sandhānī**; the physician **Suṣeṇa** directs Hanumān to **Mount Ṛṣabha / Droṇagiri**; the herbs are
  invisible to him, so he lifts the mountain. Yuddha Kāṇḍa, sarga 74.
- The **Lakṣmaṇa-rekhā** is not in Vālmīki, and is not a drawn line in the Rāmcaritmānas; it enters
  through medieval regional retellings including the Bengali Kṛttivāsī Rāmāyaṇa.
- The **Adhyātma Rāmāyaṇa** (c. 14th c., within the Brahmāṇḍa Purāṇa) has Sītā given into Agni's keeping
  and a **Māyā Sītā** abducted.
- In the **Jain Paumacariya** of Vimalasūri, **Lakṣmaṇa** kills Rāvaṇa.
- In **Kamban**, Rāvaṇa lifts the ground Sītā stands on rather than touch her.
- **Vāli** is a son of Indra; **Sugrīva** a son of Sūrya; **Aṅgada** the son of Vāli and Tārā.
- **Tārā** is the daughter of the vānara physician **Suṣeṇa** in Vālmīki; an **apsarā** of the
  ocean-churning in later sources.

Facts the author must check against the critical edition **before the dataset ships**. Do not assert any
of these in a gloss or use any of them as a criterion until checked:

1. **Ahalyā** — whether Vālmīki has her turned to stone or rendered invisible and living on air. The
   "turned to stone" image is near-universal in modern retellings and may well be later. Unsettled here.
2. **Nala's and Nīla's divine parentage** (Viśvakarmā and Agni respectively). Nala as the builder of the
   causeway is solid in Vālmīki; the parentages are not confirmed and may be from later material.
3. **Candrahāsa**, Rāvaṇa's sword — whether it appears in Vālmīki at all, or only in later Śaiva
   material. Assume not-Vālmīki until confirmed.
4. **Sampāti's burnt wings** — whether the flight toward the sun is Vālmīki's Kiṣkindhā Kāṇḍa or a later
   gloss.
5. **Every `ref` string.** Sarga numbers differ between the critical edition and the vulgate; pick one,
   say which in the reveal panel's source note, and use it consistently.
6. **Every entity's `kandas` array.** This is the most-used axis in the game and the easiest to get
   subtly wrong — a character mentioned in passing in a kāṇḍa is not the same as one who appears in it.
   Define the threshold ("named as a participant in the narrative of that kāṇḍa"), write it into the
   spec, and apply it uniformly.

The audit mode (§4.6) is the gate. No data change ships without a clean 365-day run.
