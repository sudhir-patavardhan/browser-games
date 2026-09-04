# Claude routines replace GitHub Actions as the scheduler

The marketing workflow ran on GitHub Actions cron. In September 2026 we decided to run every Cycle as a scheduled Claude Code cloud routine instead: a publish routine at the three Windows, an Analyst routine before dawn UTC, and a Sunday planning routine. There is no Actions workflow for marketing.

**Why:** the CMO wants one runtime for the system and its judgment. Routines give every run a readable transcript, can attach claude.ai connectors, and keep the Agents and the Producer in the same place.

**Trade-off accepted:** the Producer is still deterministic code, but an LLM session now invokes it. The CLI is the policy boundary — spend Caps, the approval gate, dry-run, and idempotency are enforced in code regardless of caller — and each routine's prompt is a single fixed command with an instruction never to edit code. A session that improvises around a failure is the residual risk, and the run transcript is how it is caught.

**Consequences:** secrets live in the cloud environment, not in Actions; the review-merge job is replaced by the Producer reading merged Review PRs at the start of each publish run; Chromium and ffmpeg must be installable in the sandbox or video rendering becomes a manual local step.
