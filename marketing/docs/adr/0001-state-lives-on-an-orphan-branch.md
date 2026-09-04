# Marketing state lives on an orphan branch, not on main

The Producer rewrites `marketing/data/` (queue, ledger, metrics, insights, plans) on every Cycle. Keeping that state on `main` meant every daily run rebuilt the public site, served the state files on kreeda.games, and let any code branch that happened to carry stale copies rewind live state on merge — the bug class behind the double-posting incidents of August 2026.

We decided that state is committed directly to an orphan branch, `marketing-state`, which is checked out as a git worktree at `marketing/data/` by every routine and locally. `main` holds only code. The daily review PR targets `marketing-state`. Reports and video previews live on that branch too.

**Consequences:** local setup needs one `git worktree add` command; code PRs can never touch state; the site build never sees it; the Producer, running inside a routine, is the only committer to that branch.
