/**
 * The keyboard lane's gate metadata: one package, so no registry.
 *
 * `@valdres/browser-keyboard` is not a media query — it owns a persistent
 * per-document listener hub rather than per-store-tree listeners — so it
 * deliberately stays out of `lib/browser-media-packages.ts` and has its own
 * suite runner (`check-browser-keyboard.ts`) and packed gate
 * (`test-browser-keyboard-packed-consumer.ts`).
 */
export const BROWSER_KEYBOARD_DIR = "packages/@valdres/browser-keyboard"
export const BROWSER_KEYBOARD_NAME = "@valdres/browser-keyboard"

/**
 * The exact `valdres` peer range the package must declare. beta.40 carries the
 * selector dependency-reversal fix (#401) on top of `externalAtom` (beta.39).
 * Checked by equality: the packed gate's `satisfies` check alone would also
 * accept an older, wider floor.
 */
export const BROWSER_KEYBOARD_CORE_PEER_RANGE = "^1.0.0-beta.40"
