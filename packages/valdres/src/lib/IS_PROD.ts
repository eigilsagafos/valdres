// The deep-freeze on every atom write is a dev-time correctness aid that
// catches accidental in-place mutation of atom values. In production it's pure
// overhead, so skip it — matching Recoil's `__DEV__`-gated freeze and RTK's
// dev-only immutability checks. Apps that rely on the freeze to catch mutation
// bugs still get it under dev/test; ship-time builds pay nothing.
//
// Evaluated once at module load (not per call): the write path reads a boolean
// instead of doing a `process.env` lookup + string compare on every set, and
// it's fold-friendly — bundlers that inline `process.env.NODE_ENV` can collapse
// it to `true`/`false` (the `typeof process` guard may leave a small residual
// check, but the freeze branch still largely drops out). The env must be set
// before this module is first imported (the bench scripts and prod builds do).
//
// The `typeof process` guard matters: valdres's own build does NOT replace
// `process.env.NODE_ENV` (only `VALDRES_VERSION`), so this expression ships as-is
// and is resolved by the consumer. Without the guard, importing valdres in an
// environment with no `process` global (raw browser ESM, some Deno/edge setups)
// throws at module load and takes the whole library down.
//
// `process` is declared at module scope (not global) so we don't conflict with
// consumers' @types/node or bun-types — mirroring src/index.ts.
declare const process: { env: { NODE_ENV?: string } }
export const IS_PROD =
    typeof process !== "undefined" && process.env.NODE_ENV === "production"
