// Module-scope shim so we don't pull in @types/node for `process.env`.
// Matches the pattern used in `src/index.ts` for `VALDRES_VERSION`.
declare const process: { env: { NODE_ENV?: string } }

/**
 * Whether valdres is running in production mode. Honored by paths that
 * skip dev-mode safety checks — currently `setValueInData`'s `deepFreeze`
 * pass.
 *
 * **Behavior note (post-0.2.0-pre.28):** previous releases hardcoded
 * `return false`, so `deepFreeze` ran in every build regardless of
 * `NODE_ENV`. Production builds now correctly skip freezing. If your app
 * mutates atom values in place, that mutation was previously caught with
 * a TypeError in dev *and* prod — in prod it now silently corrupts state.
 * Audit for in-place mutation before upgrading; there is no in-build
 * override that restores prod-time freezing (the dev escape hatch
 * `globalThis.__valdres_dev_skip_freeze__` only suppresses freezing, it
 * cannot re-enable it). To keep freeze-on-write in a non-dev environment,
 * build without `NODE_ENV=production`.
 */
export const isProd = (): boolean =>
    process.env.NODE_ENV === "production"
