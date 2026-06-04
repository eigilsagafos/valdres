// The deep-freeze on every atom write is a dev-time correctness aid that
// catches accidental in-place mutation of atom values. In production it's pure
// overhead, so skip it — matching Recoil's `__DEV__`-gated freeze and RTK's
// dev-only immutability checks. Apps that rely on the freeze to catch mutation
// bugs still get it under dev/test; ship-time builds pay nothing.
//
// Evaluated once at module load (not per call): the write path reads a boolean
// instead of doing a `process.env` lookup + string compare on every set, and
// bundlers that inline `process.env.NODE_ENV` can fold this to `true`/`false`
// and dead-code-eliminate the freeze branch. The env must therefore be set
// before this module is first imported (the bench scripts and prod builds do).
export const IS_PROD = process.env.NODE_ENV === "production"
