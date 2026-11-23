# Calendar

A calendar booking app in the spirit of cal.com: a host publishes free slots, a guest books a call. The stack is in place and the features are still to be built.

## Layout

A pnpm workspace with four packages:

- `api` is the TypeSpec contract. It is the single source of truth for the HTTP API.
- `server` is the Fastify backend on Node.
- `web` is the Vite, React and Mantine frontend.
- `e2e` holds the Playwright end-to-end tests.

## API first

Every change to the HTTP API starts in `api/main.tsp`. `pnpm --filter @calendar/api build` compiles it to `api/generated/openapi.yaml`, then to the types in `api/generated/schema.d.ts` and to the client SDK in `api/generated/client/`. `server` takes its request and response types from `@calendar/api`. `web` calls the API through the SDK in `@calendar/api/client`, which has one function per operation, named after its `operationId`, with the path and the request and response types of the contract. A contract change that the code has not followed fails the typecheck.

`api/openapi-ts.config.ts` configures the SDK generator, Hey API's `openapi-ts`. It is pinned to an exact version, because its 0.x releases change the generated code.

`api/generated/` is gitignored build output. Change it only by editing `api/main.tsp` and regenerating. Regenerate after a fresh clone and after every contract edit. `mise run check` does this for you.

## Verifying

`mise run verify` is the one gate, and CI runs the same command, in `.github/workflows/check.yml`, on every push to `main` and every pull request. It runs `mise run check` and then `mise run e2e`. A change is done when it passes.

`mise run check` runs the steps in `hk.pkl`: lint (oxlint), format (oxfmt), workflow lint (jactionlint for `.github/workflows/claude.yml`), contract generation, typecheck, tests and the web build. It takes seconds, so run it while you work and `mise run verify` before you push.

`mise run fix` applies the safe lint and format fixes. `mise run setup` installs dependencies and the git hooks. The hooks lint and format staged files on commit, check the commit message, and run `mise run check` on push.

Lint rules stay on. When a rule cannot be satisfied, stop and ask for a human decision. An approved exception names one path and one rule and records the reason.

`mise run dev` starts the API and the interface together. `mise run server` and `mise run web` start one of them.

`mise.toml` pins every tool. Run `pnpm` and `node` through mise (`mise exec -- pnpm ...`) when the shell has no mise activation.

## End-to-end tests

`mise run e2e` runs the Playwright tests in `e2e/tests/` in Chromium. `mise run verify` runs it after the checks. `mise run check` and the push hook do not run it.

The command starts its own server on `127.0.0.1:3100` and its own Vite dev server on `localhost:5273`, runs the tests and stops both. It fails when one of those ports is taken. `mise run dev` uses other ports, so both can run at once. The first run downloads Chromium.

Every run starts with no event types and no bookings, and all test files share that one server. A test creates the data it needs and uses names of its own, so that tests do not depend on each other. Tests choose slots relative to today. Do not fix the clock.

A booking takes its interval from every event type, and the tests run in parallel. A test that books uses a day of the booking window that no other test books on, and never fills that day. `e2e/tests/guest-booking.spec.ts` uses days 5 and 7 after today, `e2e/tests/host-bookings.spec.ts` uses day 9, and `e2e/tests/host-reschedule.spec.ts` uses day 11. Tomorrow stays free of bookings. `e2e/tests/helpers.ts` holds the steps the test files share.

Add or update an end-to-end test when a change adds or alters something a user does in the browser across the web and the server, such as creating an event type or booking a slot. Server rules and component details stay in the `server` and `web` tests.

## Server

The server follows the Fastify Getting Started and Testing guides. `server/src/app.ts` exports `build(opts)`, which registers route plugins and never listens. `server/src/main.ts` is the only file that calls `listen`. Each group of routes is a plugin in `server/src/routes/`, registered under the `/api` prefix. Tests call `build()` and use `app.inject()`.

Data lives in memory in the store that `server/src/store.ts` creates. `build()` makes one store and passes it to the route plugins as a plugin option, so every app starts empty.

`build()` also takes a `now` option, a function that returns the current moment. Tests set it to fix the clock. Read the time through it and never through `new Date()` in a route.

`server/src/slots.ts` is the one place that applies the slot rules of the contract. It takes the current moment and the bookings as inputs and does its day and hour arithmetic in Europe/Moscow, whatever zone the process runs in.

The `createBooking` handler in `server/src/routes/bookings.ts` checks the start time and stores the booking with no `await` between the two. That is what keeps two simultaneous requests from booking overlapping intervals, so keep the handler synchronous.

To fail a request, throw `ApiFailure` from `server/src/errors.ts` with a code of the contract. The error handler registered there turns it, and every failure Fastify raises while it reads a request, into the contract's `ApiError`.

Node runs the TypeScript sources directly through type stripping, with no build step. Two rules follow from that:

- Relative imports carry the `.ts` extension.
- Only erasable syntax compiles. Use union types and plain objects in place of `enum`, `namespace` and constructor parameter properties.

## Deploy

`Dockerfile` builds one image. `build()` takes a `webRoot` option, and `main.ts` sets it from `WEB_DIST`. With it, the server serves `web/dist` next to `/api` and answers a GET outside `/api` that names no file with `index.html`. The image listens on `0.0.0.0` and the port in `PORT`. The `docker` workflow builds the image and checks that it answers on `PORT`.

## Web

Render components under test inside `MantineProvider`. `web/src/test-setup.ts` stubs `matchMedia` and `ResizeObserver`, which jsdom lacks and Mantine calls.

Pages call the generated SDK functions that `web/src/api/client.ts` re-exports, and wrap each call in `send`, as in `send(listSlots({ path: { eventTypeId } }))`. Do not write request paths or `fetch` calls by hand. `send` returns the body of the answer. A failed request throws `ApiRequestError`, and `failureText` in `web/src/api/failureText.ts` chooses the text to show from its code. Component tests stand in for the server by stubbing `fetch`, which the SDK calls with a `Request`, with the helpers in `web/src/testing.tsx`.

Show every time and day through the functions in `web/src/hostTime.ts`. They write it in the host time zone, Europe/Moscow, whatever zone the browser is in.

The Vite dev server proxies `/api` to the backend on `127.0.0.1:3000`. The `API_ORIGIN` environment variable overrides that address.

## TypeScript versions

The project compiles with TypeScript 7. `tsc` runs only in `server`, `web` and `e2e`.

`api` also lists TypeScript 5, but nothing is compiled with it. `openapi-typescript` loads it as a library to print the generated types, and it cannot load TypeScript 7 ([openapi-typescript#2841](https://github.com/openapi-ts/openapi-typescript/issues/2841)). When that issue is fixed, move `api` to TypeScript 7 as well.

## Commits

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `<type>(<scope>): <summary>`, with the summary in the imperative mood and lower case. commitlint enforces this in the `commit-msg` hook and in CI, with the allowed scopes listed in `.commitlintrc.json`.

- Leave the scope out for a change that spans packages.
- Mark a breaking contract change with `!` after the scope and a `BREAKING CHANGE:` footer.
- A commit may reference a GitHub issue in a footer: `Refs #12` when it is part of the work, `Closes #12` when it finishes the issue. GitHub then links the commit to the issue, and `Closes` closes it once the commit reaches `main`.

Example: `feat(api): add booking slots endpoint`.

## Releases

release-please reads those commit messages on every push to `main` and keeps one release PR open with the next version and the `CHANGELOG.md` entry. The whole repo shares one version, kept in the root `package.json` and `.release-please-manifest.json`, with tags of the form `v1.2.3`. Merging the release PR tags the release and publishes it on GitHub. The release PR is titled `chore: release <version>` so that its commit passes commitlint.

release-please writes `CHANGELOG.md` in its own style, and the release PR runs no checks, because GitHub starts no workflows for a push made with the workflow's token. oxfmt therefore ignores `CHANGELOG.md`, so that merging a release PR leaves `main` passing. Leave the file to release-please.

## Hexlet

`.github/workflows/hexlet-check.yml` belongs to Hexlet's automated checks. Leave it and the repository name unchanged.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, through the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels, each named after its role. See `docs/agents/triage-labels.md`.

### Auto triage

The `triage` job in `.github/workflows/claude.yml` runs the triage skill on every new issue from the owner, a member or a collaborator. Like the `claude` job, it installs the skills from the `mattpocock-skills` plugin. Its instruction is the `prompt` of that job, because the `issues` event starts it and no comment carries one. The prompt starts with `/mattpocock-skills:triage`, because the skill sets `disable-model-invocation` and the Skill tool cannot load it. It reads the issue and the code, applies `bug` or `enhancement`, and posts one comment. An issue that lacks detail gets `needs-info` and numbered questions for the reporter. A complete issue gets `needs-triage` and a recommended state. The maintainer applies `ready-for-agent`, `ready-for-human` and `wontfix`.

The job skips an issue opened with the `ready-for-agent` label. `to-spec` and `to-tickets` publish their issues with that label, so pass it to `gh issue create --label` and do not add it afterwards. The job also skips an issue that mentions `@claude`, which the `claude` job answers.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
