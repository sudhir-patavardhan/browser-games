# The hub page is the source of truth for Games and Categories

Marketing kept its own game list with its own category tags, and by September 2026 it had drifted to 20 games in 4 ad-hoc groups while the site shipped 29 games across 7 rails; an entire Category was invisible to the Strategist. We decided that the hub's `index.html` rails define which Games exist and which Category each is in, and the marketing catalog reads that at load time, keeping only the hand-written Dossier per Game. A test fails when a Game is on the hub without a Dossier.

**Considered:** a shared `games.json` manifest generating both hub and catalog — rejected because the hub is a hand-authored single file by design and a build step would break that contract.
