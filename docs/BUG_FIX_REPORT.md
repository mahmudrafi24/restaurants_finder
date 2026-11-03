# Frontend bug fixes

Date: 2026-11-03. Branch: `fix/frontend-bug-audit`. Based on the frontend `dev` branch.

## Implemented changes

| Audit ID         | Resolution                                                                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 7                | Autocomplete no longer preserves previous-query placeholder data. Results cannot be selected during debounce, fetching, or an error. Only settled results matching the current input are selectable.                                       |
| 8                | Enter submits the typed city when no suggestion can be selected, including empty/error/loading lists. Normal suggestion selection and IME composition are preserved.                                                                       |
| 9                | Fetch and response-body reads now share transport error handling. JSON, error-body and file-download failures distinguish timeout, network interruption, caller cancellation and malformed content. API error codes/details are preserved. |
| 12               | Export submission checks actual serialized UTF-8 bytes before sending; oversized exports show a filtering hint. Field and cuisine bounds match the backend.                                                                                |
| Build dependency | System sans/monospace font stacks replace Google Fonts downloads, removing a build-time network dependency and a self-referencing CSS font variable. Typography now follows the user's system fonts.                                       |

Result table state resets for a different submitted search, so filters from a cached previous city do not silently hide the new city's rows. The error UI handles admission limits and payload size errors. The test command is included in `npm run verify`.

Backend findings 1–6, 10–14, server-side deadlines/limits and export safety are handled on `fix/backend-bug-audit` in the API repository.

## Verification

- ESLint, TypeScript and Prettier checks passed.
- 16 regression tests passed through `npm test`. They cover autocomplete state/keyboard decisions, JSON/schema failures, body-read interruption/timeouts, cancellation, API errors, filename/file handling and UTF-8 export limits.
- Tests use Node's built-in test module and the already-installed TypeScript compiler. The test-only loader resolves the application's `@/` alias. No new dependencies are required.

```bash
npm test
npm run lint
npm run typecheck
npm run format:check
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000 npm run build
```

The configured public API URL is required at build time. Replace the local example with the deployed API origin for production. A full browser integration run and a deployed frontend/backend smoke test remain necessary before merging.

## Build environment limitations

This sandbox forbids the local listener required by Turbopack, so the default `npm run build` cannot complete here. It also drops captured child-process stdout, which prevents the default TypeScript CLI configuration step in an ordinary webpack build.

A verification-only launcher outside the repository uses webpack, the TypeScript compiler API and worker threads to avoid those sandbox limitations. No such overrides are committed. The font-fetch dependency has been removed from the actual application. The alternate production build passed with `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000`: compilation, TypeScript, static prerendering and build tracing completed for `/` and `/_not-found`. This validates a webpack build; the default Turbopack build still needs a normal CI environment.

## Behavior and deployment limits

Deploy alongside the backend changes for the 4,000,000-byte limit and matching text bounds. CSV export may prefix spreadsheet-sensitive text, including `+` phone values, with an apostrophe to keep it literal in spreadsheet readers. XLSX preserves those text values as strings. Large exports must be narrowed with table filters; no background export service is introduced.

The frontend test coverage is focused unit/regression coverage, not a substitute for browser tests of focus, pointer/touch interactions, accessibility and all supported browsers.

## Follow-up code refactor

The API client was rewritten as a small public facade in `src/lib/api/client.ts`, with dedicated
modules for transport/timeouts (`transport.ts`), response validation and download headers
(`response.ts`), and error types (`error.ts`). HTTP error handling is centralized for JSON and
file downloads. Existing imports remain compatible, and all 16 regression tests still pass.

## Follow-up: retry from the search form

Resubmitting a failed search with the same settings previously only updated React state. Because
the query key stayed the same, TanStack Query did not start a new request. The form now explicitly
refetches a failed current query. Comparison uses canonical query keys, including normalized city
casing and sorted amenities. Changed searches still select their own query, successful results
retain caching, and submissions during an active fetch are ignored.

Four component callback regression cases cover equivalent failed searches, changed requests,
successful/initial submissions, and active requests.
