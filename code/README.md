# Endorphin AI — source code

This folder holds the source of the `endorphin-ai` npm package (version 1.x): an end-to-end testing framework that runs tests written in plain English with an AI agent and Playwright.

For what it does and how to use it, see the [project README](../README.md) and the [user guide](../doc/user-guide).

## Layout

| Folder | What is in it |
|---|---|
| `framework/` | the framework itself: CLI, AI agent, browser tools, reporters, test recorder |
| `bin/` | the `endorphin` command |
| `scripts/` | build scripts |
| `dev-tests/` | the framework's own tests (Jest) |
| `playground/` | a small project for running real tests by hand |

## Working on it

```bash
cd code
npm install
npm run build        # TypeScript -> dist/
npm run test:unit    # unit tests
npm run type-check
npm run lint
```

Running a real test needs an API key in `.env` (see `playground/.env.example`):

```bash
cd playground && npx tsx ../bin/endorphin.ts run test HEALTH-001
```

## License

AGPL-3.0-or-later, see [LICENSE.md](LICENSE.md). The name and logo are covered by [TRADEMARK.md](../TRADEMARK.md).
