# Maidan — a daily cricket grid

**Slug:** `maidan` · **URL:** `kreeda.games/maidan/` · **Category:** sports · **Tag:** DAILY

The same 3×3 grid as `RAMAYANA_GRID.md` — three criteria down, three across, nine cells, nine guesses,
one grid a day for everybody — with cricketers in the cells instead of beings from the epic.

Named for the open ground the game is actually played on across South Asia, which is a place and not a
brand. That matters more than it sounds; see §4.

**This spec is a delta.** Everything in `RAMAYANA_GRID.md` applies unless contradicted here:

| Shared, unchanged | Where |
|---|---|
| The 3×3 loop, one-use-per-grid, 9-guess budget, five submission outcomes | §1, §3.4 |
| The `norm()` pipeline, alias-over-normaliser architecture, fuzzy fallback, disambiguation | §3 |
| Bitsets, the exclusivity rule, the 200-attempt generator, `min(n) ≥ 3`, perfect-matching check | §4 |
| Weight scoring and the honesty note about rarity | §7 |
| The three-glyph share grid and the no-per-cell-Weight rule | §9 |
| Bottom-sheet input, typeahead-must-not-filter, accessibility, `/DAILY.md` storage contract | §3.5, §10 |

Substitute the slug: `maidan.dbest`, `maidan.best`, `maidan.streak`, `maidan.state`, `maidan.settings`.
Share header `Kreeda · Maidan · 24 Aug`, footer `kreeda.games/maidan/`.

---

## 1. The entity set

**Answers are international cricketers.** Men's and women's, all three formats, all eras, one roster.

**Target size: ~600 players.** Roughly: twelve full-member nations at ~35 apiece (≈ 420), plus ~120
women's internationals, plus ~60 pre-1970 figures who anchor the era axes.

### 1.1 One mixed roster, gender-neutral criteria

Women's cricket is in the roster from v1 and is not a separate mode bolted on later.

The mechanism that makes this work is that **milestone facts are naturally comparable across the men's
and women's games**. "Scored an ODI double century" is true of Belinda Clark and Amelia Kerr and of
Tendulkar, Sehwag, Rohit Sharma, Gayle, Guptill, Fakhar Zaman, Ishan Kishan, Shubman Gill and Maxwell.
That is one honest, uncontrived, eleven-deep cell.

Two consequences worth writing down:

- **A criterion whose answer set is all-women or all-men by construction is allowed but must say so in
  its label** — "Played in a Women's Cricket World Cup final", not "Played in a World Cup final".
  Ambiguity here reads as carelessness and it is.
- **The `min(n) ≥ 3` rule does real work here.** "Played for Australia ∧ scored an ODI double century"
  resolves to Glenn Maxwell and Belinda Clark: two answers, so the generator rejects the grid. That is
  the system working, not a gap to paper over.

### 1.2 Player schema

Same shape as `RAMAYANA_GRID.md` §5.1, with cricket fields:

```js
{ id:      'sangakkara-k',        // stable slug — saves store these. Never renumber.
  name:    'Kumar Sangakkara',    // canonical display
  nations: ['sl'],                // MULTI-VALUED — see §2.1
  debut:   1997,                  // year of first international appearance, any format
  last:    2015,                  // year of last, or 0 if still active at DATA_AS_OF
  formats: ['test','odi','t20i'],
  roles:   ['keeper','top-order','captain','left-hand-bat'],
  marks:   ['test-200','test-300','test-10000-runs','wc-final','odi-century-knockout'],  // §2.2
  domestic:['sl-nondescripts','eng-county','aus-t20'],   // coarse, geographic, §4.3
  fame:    5,                     // 1..5, drives Weight exactly as in Setu
  tier:    'core',
  alt:     ['Sangakkara','Sanga','KC Sangakkara','K Sangakkara','Kumar Sangakara',
            'कुमार संगकारा'],
  note:    '' }
```

`DATA_AS_OF` is a single file-level constant (§3.2), not a per-player field.

### 1.3 Name matching — the deltas from Setu

The `norm()` pipeline carries over intact, including the Devanāgarī transliterator: Indian users type
`विराट कोहली` more often than an English-language repo expects, and the code is already written. Four
cricket-specific additions:

- **Initials are the normal form.** `MS Dhoni`, `M.S. Dhoni`, `MSD`, `Mahendra Singh Dhoni`, `Mahi`,
  `Dhoni`. Step 4 of `norm()` (letters only) already eats the periods and spaces; the rest are aliases.
- **Bare surnames must resolve, because that is how cricket is spoken.** Every player's `alt` carries the
  bare surname **where it is unambiguous in the roster**.
- **Where a surname is ambiguous it must produce a disambiguation prompt, never a guess.** `Waugh` →
  "Steve Waugh or Mark Waugh?" Likewise `Chappell`, `Marsh`, `Khan`, `Hussey`, `Pandya`, `Bravo`,
  `Mohammad`, `Ali`, `Akram`/`Akmal`, `Flower`, `Morkel`, `Yadav`, `Sharma`, `Curran`. This reuses Setu's
  §3.4 outcome (b) — free, costs no guess — and it will fire far more often here than it ever does in
  Setu. Budget for it in the sheet layout: two to four buttons, not one.
- **Nicknames, where they are the common usage and not a jibe**: `Murali`, `Sanga`, `Punter`, `The Wall`,
  `Jaddu`, `Boom Boom`, `Beefy`, `Dilscoop` (no — that is a shot, not a person; the point is that the
  list is curated). Excluded: anything derogatory, anything racialised, anything a player has objected to.

The build-time collision assertion (Setu §3.6) matters more here than in Setu, because ~600 names with
heavy surname reuse produces genuine collisions. Expect the first run to fail and to need aliases pruned.

---

## 2. The axes

Six families, same exclusivity rule as Setu §2.2 (two criteria from a *single-valued* family must not sit
on opposite axes).

| Family | Tag | Multi-valued? | Examples |
|---|---|---|---|
| `nation` | `nations[]` | **yes** | "Played for India", "Played for Ireland" |
| `era` | `debut` | no (derived) | "Debuted in the 1990s", "Debuted in the 2010s" |
| `format` | `formats[]` | yes | "Played Test cricket", "Played T20 internationals" |
| `role` | `roles[]` | yes | "Kept wicket", "Bowled left-arm spin", "Captained their country" |
| `mark` | `marks[]` | yes | "Scored a Test double century", "Took ten wickets in a Test match" |
| `domestic` | `domestic[]` | yes | "Played county cricket in England", "Played Sheffield Shield" |

### 2.1 Nation is multi-valued, and that is a feature

Players who represented two countries make excellent cells. Kepler Wessels played for Australia and then
South Africa. Eoin Morgan, Ed Joyce and Boyd Rankin each played for Ireland and then England — three
answers, exactly at the `min(n) ≥ 3` floor, which makes "Played for Ireland ∧ Played for England" a
legal and delightful cell.

Most nation pairs are of course empty, and the generator's popcount check throws those out for free
without needing a special rule. Do not add one.

### 2.2 Marks — the criteria that keep the data honest

**Every `mark` is an event that happened, never a total that grows.** This is the single most important
design decision in the cricket game and §3 is entirely about why.

Representative vocabulary (~30 values):

`test-200` `test-300` `odi-200` `test-5wi` `test-10wm` `test-debut-century` `intl-hat-trick`
`test-captain` `odi-captain` `wc-final` `wc-winner` `t20wc-final` `wwc-final` `odi-century-knockout`
`test-10000-runs` `test-300-wickets` `odi-10000-runs` `odi-300-wickets` `intl-100-centuries`
`test-1000-runs-calendar-year` `kept-in-wc-final` `six-sixes-in-an-over` `test-double-hundred-away`

Thresholds are fine — a player who has passed 10,000 Test runs never un-passes it, so a threshold is as
monotone as an event. **Rankings are not fine.** No "leading run-scorer for X", no "most", no "highest",
no "fastest", no "youngest", ever. Those flip when somebody has a good week, and a criterion that flips
turns the whole game into a liar.

`intl-100-centuries` is a one-player criterion (Sachin Tendulkar). It is legal in the catalogue because
`min(n) ≥ 3` guarantees it can never *land* in a grid unless intersected with something broad enough —
in practice it will almost never survive generation. Keep it: it is a good reveal-panel fact.

### 2.3 Era

Derived from `debut`, bucketed by decade: pre-1960s, 1960s, 1970s, 1980s, 1990s, 2000s, 2010s, 2020s.
Single-valued and therefore subject to the exclusivity rule — two era criteria may sit on the same axis
(they are three separate rows) but never on opposite axes, where they would guarantee empty cells.

Era pairs beautifully with nation and with marks, and it is the axis that makes the game reward history
rather than only recency. Weight it in: `tier:'core'` for the 1990s/2000s/2010s, `tier:'wide'` for the
1970s/1980s, `tier:'deep'` for pre-1960s.

---

## 3. The data problem

Cricket facts are voluminous, they change with every match, and the game has no backend to refresh from.
Three mechanisms hold it together.

### 3.1 Monotone facts only

A dataset built entirely of monotone facts — events that happened and thresholds that have been crossed —
**can never become wrong. It can only become incomplete.**

That asymmetry is the whole strategy. A wrong dataset rejects a correct answer *and* accepts an incorrect
one, and the player cannot tell which failure they are looking at. An incomplete dataset only ever
rejects a correct answer, which is a single, explicable, apologisable failure mode — and §3.2 makes it
explicable in the interface rather than baffling.

Concretely: "Scored a Test double century" is monotone. "Has the highest score for Australia" is not.
"Took 300 Test wickets" is monotone. "Is Australia's leading wicket-taker" is not. Any criterion you
cannot phrase in the past tense without an implicit "as of today" is disqualified.

### 3.2 Freeze, display, and warn

- `const DATA_AS_OF = '2026-08-01';` — one constant, shipped in the file.
- **Displayed in the footer and in the reveal panel**: *"Facts current to 1 August 2026."* A player whose
  correct answer is rejected can see immediately why, which converts an infuriating bug into a
  comprehensible limitation.
- **Retirement bias.** Target roughly **70% retired players**. A retired player's `marks` are frozen for
  good; an active player's are a moving target. This is not a compromise on interest — the historical
  roster is where the good era cells live anyway.
- **Active players carry only marks they have already achieved**, and preferentially marks unlikely to be
  joined by a crowd next season.
- **A staleness guard.** If `Date.now()` is more than 400 days past `DATA_AS_OF`, show a persistent,
  dismissible banner: *"This dataset is from August 2026 and hasn't been refreshed. Careers since then
  are missing."* Eight lines of code, and it is the difference between a game that ages honestly and one
  that quietly starts lying. **Do this even though it is embarrassing.** Especially then.

### 3.3 Refresh cadence

Quarterly, or after each major ICC event, whichever is sooner. The refresh is a diff to a JS literal in
one HTML file and a redeploy — no schema migration, no backfill, no database. A checklist:

1. New debutants worth adding to the roster (and their `fame`).
2. Newly-crossed thresholds and newly-achieved marks for players already in the roster.
3. New nations for anyone who switched allegiance; new `domestic` entries.
4. `last:` set for anyone who retired.
5. Bump `DATA_AS_OF`.
6. Run the 365-day audit (`RAMAYANA_GRID.md` §4.6) and confirm no day fell back and no cell dropped below
   three answers.

Because `id`s are stable and saves store `id`s, a refresh never invalidates an in-progress grid.

---

## 4. The licensing boundary

This section is a design constraint, not legal advice, and the author should take a real opinion before
monetising anything.

### 4.1 What is safe: the facts

Player names, nationalities, debut and retirement dates, teams represented, and match statistics are
**facts**, and facts are not protected by copyright.

- **United States**: *Feist Publications v. Rural Telephone Service* (1991) — facts are not original
  authorship and a compilation is protected only in its selection and arrangement, not in its data.
- **India**, and directly on cricket: in *Star India Pvt. Ltd. v. Piyush Agarwal* (Delhi High Court,
  2013) the court held that information emanating from a cricket match — scores, match alerts — amounts
  to *facts*, which cannot be owned or given copyright protection, and that what is protected is the
  broadcast recording itself, not the information in it.

So a hand-built table of factual cricket statistics is on firm ground.

### 4.2 What needs care: the database, not the facts

The EU/UK ***sui generis* database right** (Directive 96/9/EC) protects substantial investment in
*obtaining and verifying* a database even where each individual fact is free. The CJEU's *British
Horseracing Board v. William Hill* line narrows it to investment in *obtaining* data rather than
*creating* it, which helps, but the practical instruction is simple:

> **Do not bulk-copy any single commercial source's table.** Compile from multiple public references,
> re-key by hand, and select and arrange for this game's own purposes. That is both defensible and, as it
> happens, the only way to get the `fame` and `tier` judgements right anyway.

It also removes any "hot news" exposure, since nothing here is time-sensitive by construction (§3.1).

### 4.3 What is out of bounds: the branding

Absolutely excluded, permanently, not just from v1:

- **Team logos, franchise crests, kit designs, official wordmarks as marks, official typefaces.**
- **Player photographs and likenesses.**
- **Anything implying endorsement, affiliation or official status.**

> **Maidan ships zero image files.** Every visual element is CSS or hand-drawn inline SVG, and no SVG
> depicts a crest, a flag, or a person. This is stated as an absolute because it makes the entire logo
> question disappear rather than requiring a judgement call per asset.

**Franchise T20 teams are out of the axes entirely in v1.** "Chennai Super Kings" used as a factual
descriptor of where somebody played is ordinary nominative use and journalists do it daily — but it is a
live trademark, and nine franchise names across a grid header starts to look like an unlicensed product
rather than a factual reference. Not worth it for a free game.

What replaces them:

- **National teams**, which is where the interesting intersections are anyway.
- **Coarse geographic domestic descriptors**: "played first-class cricket for an English county",
  "played in the Sheffield Shield", "played Ranji Trophy cricket". Geographic, long-established,
  descriptive.
- If a franchise axis is ever wanted, the defensible shape is a **single boolean per competition** —
  "played in the IPL" — which is a factual statement about a competition, carries no crest, and names no
  team. Not v1.

---

## 5. Presentation

Follows `RAMAYANA_GRID.md` §10 with a different skin: Setu's dawn-over-a-strait becomes an evening
maidan — dusty ochre ground, a green square, floodlight white. Proposed tokens:

```css
--ground:#c9a86a;   --ground-dark:#a8874c;  --square:#5f7f4a;  --crease:#f6f1e4;
--dusk-hi:#2c3f5e;  --dusk-lo:#e8925a;      --lamp:#fff3c8;
--ink:#20180c;      --ink-dim:#5d4e35;      --rule:rgba(60,44,20,.45);
```

Dark mode is the same ground under floodlights: `--ground:#3a3222`, `--square:#2c3a26`, crease-white
panels dropped to `#d8d2c2` on a near-black surface.

An empty cell is bare ground; a filled cell is a chalked-in name on the crease-white panel, with the same
corner-notch state marker as Setu (state is never colour-only).

Audio, per Setu's rules — oscillators only, no files: a bat-on-ball knock for a correct answer (short
band-passed noise burst plus a low sine), a flat pad for wrong, a light crowd-swell built from filtered
noise at 9/9. **No commentary, no recorded crowd, no sampled anything.** Off by default is not necessary
here; on by default, mutable, per `maidan.settings`.

**No Devanāgarī in the grid headers** — cricket criteria are English by nature. The Devanāgarī support in
`norm()` is for *input* only. Player `alt` lists may carry Devanāgarī forms; nothing renders in it.

---

## 6. Out of scope for v1

- **Franchise T20 leagues as an axis** (§4.3). Any image of any kind. Player photographs, permanently.
- **Live or fetched data.** Nothing networked. The file is the dataset.
- **Venue, ground and country-of-performance axes** ("scored a century at Lord's"). Tempting and rich,
  but they multiply the verification burden by the number of grounds and they age badly.
- **Head-to-head and opposition axes** ("scored a century against Australia"). Same reason.
- **Format-specific sub-grids** (a Tests-only grid, a T20-only grid).
- **Domestic-only players.** International appearance is the entry requirement; without it the roster has
  no edge and no reasonable player could be expected to know it.
- **Umpires, coaches, commentators, administrators.** Players only.
- **True rarity scoring.** Same impossibility, same substitute, same honesty note as Setu §7.3.

---

## 7. Verify before shipping

Checked while writing this spec, and safe to rely on as of August 2026:

- **Brian Lara's 400\*** against England in 2004 remains the highest individual score in Test cricket.
- **Muttiah Muralitharan's 800** Test wickets, from 133 Tests, remains the most by any bowler, ahead of
  Shane Warne.
- **Amelia Kerr's 232\*** (New Zealand v Ireland, Dublin, 13 June 2018) is the highest individual score
  in women's ODIs; **Belinda Clark's 229\*** (Australia v Denmark, Mumbai, 16 December 1997) is second
  and was the first double century in any ODI.
- **Rohit Sharma** holds the men's record of three ODI double centuries, with a best of 264.
- **Ishan Kishan's** 126-ball double century (v Bangladesh, 2022) is the fastest in men's ODIs.
- Cricket match information such as scores and alerts are *facts* and not copyrightable in India per
  *Star India v. Piyush Agarwal* (Delhi HC, 2013).

**Must be re-verified at the data freeze, against a public statistical reference, on the day of the
freeze.** These came from secondary sources while drafting and at least one of them will have moved:

1. **The complete ODI double-century list**, men's and women's. Used as a worked example twice in this
   document; get the full list right before it becomes a criterion.
2. **The complete ten-wickets-in-a-Test-match list**, and the Test triple-century list.
3. **Every threshold mark** (`test-10000-runs`, `test-300-wickets`, `odi-10000-runs`, etc.) — the
   membership of each is a list that grows, and §3.1 protects against it becoming *wrong* but not against
   it becoming *short*.
4. **Dual-nationality players.** Kepler Wessels (Australia, South Africa) and Eoin Morgan / Ed Joyce /
   Boyd Rankin (Ireland, England) are asserted above and are the basis of a cell in §2.1. Confirm each,
   and sweep for others — the axis is only as good as its completeness.
5. **Every player's `debut` year**, which drives the era axis and is easy to get off by one when a player
   debuted in one format years before another. Define it as *first international appearance in any
   format* and apply it uniformly.
6. **Every `fame` value.** Unlike Setu's, these are contestable in a way readers will notice, and they
   drive Weight. Have a second cricket-literate person review the 1s and the 5s.
