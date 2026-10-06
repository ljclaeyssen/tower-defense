# Lessons

- 2026-10-06 — Owner asked twice to delegate to Opus/Sonnet subagents to save tokens: default to
  subagents for any multi-file implementation, keep the main context for contracts and integration.
- 2026-10-06 — Multi-line heredocs with apostrophes inside comments broke a long Bash call on Git
  Bash/Windows; for multi-file TypeScript writes prefer the Write tool or one file per heredoc.
- 2026-10-06 — Browser pane: screenshot coordinates are in the screenshot frame, which can differ
  from CSS pixels (frame 800x450 for a 1280x720 viewport); always read the reported frame before
  clicking computed coordinates, and pass `tabId` in every batched action (the fronted tab can change).
- 2026-10-06 — Angular dev server prebundles npm-workspace libs through Vite; exclude them with
  `prebundle.exclude` or lib edits are silently ignored until restart.
