# marketing-state

Kreeda marketing's state. **Code does not live here** — this branch is checked out
as a git worktree at `marketing/data/` and holds only what the system writes:
the Post queue, the Campaign ledger, metrics, Agent outputs, Run logs and the
Briefing.

The Producer is the only committer. The daily Review targets this branch.
See `marketing/docs/adr/0001-state-lives-on-an-orphan-branch.md` on `main`.
