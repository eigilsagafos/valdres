// The deep-freeze on every atom write is a dev-time correctness aid that
// catches accidental in-place mutation of atom values. In production it's pure
// overhead, so skip it — matching Recoil's `__DEV__`-gated freeze and RTK's
// dev-only immutability checks. Apps that rely on the freeze to catch mutation
// bugs still get it under dev/test; ship-time builds pay nothing. Process-less
// runtimes default to production so raw CDN/edge consumers do not silently pay
// for these checks. The development export condition is built with an explicit
// process-less development fallback for debugging in those runtimes.
//
// Evaluated once at module load (not per call): the write path reads a boolean
// instead of doing a `process.env` lookup + string compare on every set, and
// it's fold-friendly — bundlers that inline `process.env.NODE_ENV` can collapse
// it to `true`/`false` (the `typeof process` guard may leave a small residual
// check, but the freeze branch still largely drops out). The env must be set
// before this module is first imported (the bench scripts and prod builds do).
//
// The published package ships three graphs (see packages/valdres/build.ts):
//
//   - `exports.production`: every `IS_PROD` *use site* is rewritten to the
//     literal `true` before minify, so the freeze and the architecture
//     counters DCE. Vite/webpack production builds match this condition. An
//     imported `const IS_PROD = true` is not enough — Bun does not fold that
//     binding across modules.
//   - `exports.import` / `default`: this file ships as-is. Process-less
//     runtimes default to production. When `process.env` exists, NODE_ENV is
//     resolved at runtime so Node/Bun/esbuild still freeze in development.
//   - `exports.development`: this file ships as-is with a process-less
//     development fallback. Vite/webpack resolve it in `vite dev` / webpack
//     `--mode development`.
//
// The guards matter for the unfolded graphs: valdres's own build does NOT
// replace `process.env.NODE_ENV` (only `VALDRES_VERSION`), so this expression
// ships as-is and is resolved by the consumer. We guard both `process` (missing
// in raw browser ESM / some Deno/edge runtimes) and `process.env` (a minimal
// polyfill may set `process` to `{}` without an `env`); either would otherwise
// throw at module load and take the whole library down. This is the
// React/Redux idiom. Plain member access (no optional chaining) keeps
// `process.env.NODE_ENV` matchable by consumer bundlers for dead-code
// elimination.
//
// `process` and the build define are declared at module scope (not global) so
// we don't conflict with consumers' @types/node or bun-types — mirroring
// src/index.ts. The `typeof` guard also leaves unbuilt source safe: without the
// define, a process-less source consumer gets the production default.
declare const process: { env?: { NODE_ENV?: string } }
declare const __VALDRES_PROCESSLESS_DEVELOPMENT__: boolean

const PROCESSLESS_DEVELOPMENT =
    typeof __VALDRES_PROCESSLESS_DEVELOPMENT__ !== "undefined" &&
    __VALDRES_PROCESSLESS_DEVELOPMENT__

export const IS_PROD =
    typeof process === "undefined" || process.env == null
        ? !PROCESSLESS_DEVELOPMENT
        : process.env.NODE_ENV === "production"
