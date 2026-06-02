# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # run with node
npm run dev        # run with nodemon (auto-restart)
npm test           # run all Jest tests
npm run lint       # ESLint over src/
npx jest --testNamePattern="creates a task"  # run a single test by name
```

Copy `.env.example` to `.env` and set `PORT`, `MONGO_URI`, and `NODE_ENV` before starting.

## Architecture

Three-layer Express app:

- **`src/api/tasks.js`** — Express router; thin handlers that delegate to the service layer and set HTTP status codes.
- **`src/utils/taskService.js`** — All business logic. Currently uses an **in-memory array** (not MongoDB), despite `mongoose` appearing in `package.json`. Tasks have the shape `{ id, title, description, dueDate, completed }`.
- **`src/components/TaskCard.js`** — Returns an HTML string fragment for rendering a task; no framework involved.

`src/index.js` wires everything together: loads `.env`, mounts the router at `/api/tasks`, and starts the server.

Tests in `tests/` import the service layer directly and run against the in-memory store — no server or database needed.

## gstack

Use `/browse` for all web browsing tasks. Never use `mcp__claude-in-chrome__*` tools.

Install for new teammates:
```bash
git clone --single-branch --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack && cd ~/.claude/skills/gstack && ./setup
```

Available gstack skills:
`/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/setup-gbrain`, `/retro`, `/investigate`, `/document-release`, `/document-generate`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`
