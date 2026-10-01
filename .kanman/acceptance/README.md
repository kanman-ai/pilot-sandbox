# Acceptance specs

This folder holds the executable acceptance specs for stories. kanman uses them as the outcome gate.

## Layout

Each story gets its own folder named after its key:

```
.kanman/acceptance/<KEY>/<name>.spec.ts
```

For example `.kanman/acceptance/SBX-1/list-invoices.spec.ts`.

## Who writes them

Specs are written only by kanman's spec author, from the story's Demonstrate block, before the story moves to Ready.
The implementation never edits files in this folder. If a change in a pull request touches `.kanman/acceptance/`, the diff guard stops the run.

## Rules for a spec

- It runs against the real app, started with `docker-compose.acceptance.yml`.
- It does not mock its own target. No route interception, no MSW, no nock, no module mocks.
- Before the story is built, it must fail. A spec that already passes does not test the new behaviour.
- After the story is built, it must pass on a clean checkout in a fresh environment.

## Running specs

Start the app, then run one story or all of them:

```
docker compose -f docker-compose.acceptance.yml up -d --build --wait
npx playwright test .kanman/acceptance/SBX-1/
npx playwright test
docker compose -f docker-compose.acceptance.yml down -v
```

Keep the trailing slash when you pass a folder. Playwright treats the argument as a pattern, so `SBX-1` would also match `SBX-12`.

Traces, screenshots and video are recorded for every test and land in `test-results/`. The JSON report is `test-results/results.json`.
How these files are found is declared in `.kanman/acceptance.json`.
