# The routine session is the Agent; the CLI prepares inputs and accepts outputs

With every Cycle running as a Claude routine, a model is already present when an Agent's judgment is needed. We decided that the five judgment roles — Analyst, Strategist, Media Buyer, Performance Analyst, Chief of Staff — are played by the routine's own session rather than by an API call from code. For each role the CLI offers `prepare`, which gathers every input into one file, and `accept`, which validates the output against the role's schema and commits it; the role's prompt file sits between them. The Creative stays a Gemini call made by code: it is per-Post, high-volume, needs rendering tools, and was already wired.

**Why:** no API key or second bill, the reasoning is visible in the run transcript, and the same prompt files run identically in a local Claude Code session.

**Consequences:** an Agent is testable only through its prepare and accept halves; the model is chosen per routine, not per role; malformed output is rejected by `accept`, never patched.
