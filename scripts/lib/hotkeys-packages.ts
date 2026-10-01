/**
 * The hotkeys lane's release metadata: `@valdres/hotkeys` and its React
 * bindings, released together. Peer floors are checked by equality — a
 * `satisfies` check alone would also accept an older, wider floor.
 */
export const HOTKEYS_PACKAGES = [
    { name: "@valdres/hotkeys", dir: "packages/@valdres/hotkeys" },
    { name: "@valdres-react/hotkeys", dir: "packages/@valdres-react/hotkeys" },
] as const

/**
 * The exact peer ranges each package must declare, and why each floor is what
 * it is:
 * - `valdres` beta.41 is the first core with `store.sub(…, { settle })`.
 * - `@valdres/browser-keyboard` beta.10 and `valdres-react` beta.8 are the
 *   releases carrying the native keydown bridge and `useStore(store?)`.
 * - `@valdres/hotkeys` beta.8 is the first release of the v1 hotkeys API; the
 *   published beta.7 still carries the retired callback API.
 */
export const HOTKEYS_PEER_RANGES = {
    "@valdres/hotkeys": {
        "@valdres/browser-keyboard": "^1.0.0-beta.10",
        valdres: "^1.0.0-beta.41",
    },
    "@valdres-react/hotkeys": {
        "@valdres/hotkeys": "^1.0.0-beta.8",
        react: ">=18",
        valdres: "^1.0.0-beta.41",
        "valdres-react": "^1.0.0-beta.8",
    },
} as const

/** Published versions that predate what each floor requires. */
export const HOTKEYS_EXCLUDED_PEER_VERSIONS = {
    "@valdres/hotkeys": "1.0.0-beta.7",
    "@valdres/browser-keyboard": "1.0.0-beta.9",
    "valdres-react": "1.0.0-beta.7",
    valdres: "1.0.0-beta.40",
} as const
