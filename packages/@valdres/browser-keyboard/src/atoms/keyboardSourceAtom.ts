import { externalAtom, type ExternalAtom } from "valdres"
import type { KeyboardSourceSnapshot } from "../lib/KeyboardSourceSnapshot"
import { keyboardSource } from "../lib/keyboardSource"

/**
 * @internal The package's single external source. Not exported: every public
 * read is a selector over it, so held keys and the latest keydown always come
 * from one publication.
 */
export const keyboardSourceAtom: ExternalAtom<KeyboardSourceSnapshot> =
    externalAtom(keyboardSource, {
        name: "@valdres/browser-keyboard/source",
    })
