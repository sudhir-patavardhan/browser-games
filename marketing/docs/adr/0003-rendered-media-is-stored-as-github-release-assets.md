# Rendered media is stored as GitHub Release assets

A Post's video is rendered by the Creative on one day, reviewed by the CMO, and published by the Producer on a later day on a different runner. Workflow-run artifacts vanish with the run and are zip-behind-login, and committing ~12 MB per video to the state branch would grow the repo by about half a gigabyte a year. We decided the Creative uploads each rendered MP4 and PNG card as assets on a rolling GitHub Release named `media`, records the asset URLs on the Post, and the Producer downloads that exact file at publish time. The Review links the MP4 directly, so it plays in the browser. Assets older than thirty days are pruned.

**Consequences:** previews are public before they are posted (acceptable: the content is about to be public); what the CMO approved is byte-for-byte what goes out; nothing binary enters git.
