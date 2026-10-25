@AGENTS.md

## Claude-specific
- Use Grep with a path + line range Read rather than reading `public/js/app.js` or `server/index.js` whole.
- Don't spawn subagents for this repo; it is small enough to handle inline.
- Run `/compact` or start a fresh session between unrelated tasks.
