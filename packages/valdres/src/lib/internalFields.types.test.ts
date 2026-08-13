import { test } from "bun:test"
import type { Atom, AtomFamily, Selector, SelectorFamily } from "../index"
import type { InternalAtom } from "../types/InternalAtom"
import type { InternalAtomFamily } from "../types/InternalAtomFamily"
import type { InternalSelector } from "../types/InternalSelector"
import type { InternalSelectorFamily } from "../types/InternalSelectorFamily"

declare const atom: Atom
declare const selector: Selector
declare const atomFamily: AtomFamily<unknown>
declare const selectorFamily: SelectorFamily<unknown, [unknown]>
declare const internalAtom: InternalAtom
declare const internalSelector: InternalSelector
declare const internalAtomFamily: InternalAtomFamily<unknown>
declare const internalSelectorFamily: InternalSelectorFamily<unknown, [unknown]>

test("engine-only fields stay off public state types", () => {
    if (false) {
        // Engine-only fields must not be reachable through public types.
        // @ts-expect-error internal compat-layer mount hook
        atom.__valdresOnMount
        // @ts-expect-error internal cache metadata atom
        atom.__cacheMeta
        // @ts-expect-error internal cache metadata selector
        atom.__cacheMetaSelector
        // @ts-expect-error internal state marker
        atom.__valdresInternal

        // @ts-expect-error internal compat-layer mount hook
        selector.__valdresOnMount
        // @ts-expect-error internal state marker
        selector.__valdresInternal

        // @ts-expect-error internal compat-layer mount marker
        atomFamily.__valdresOnMount
        // @ts-expect-error internal weak identity cache
        atomFamily.__valdresAtomFamilyMap

        // @ts-expect-error internal strong identity cache
        selectorFamily.__valdresSelectorFamilyMap

        // The corresponding engine intersections retain every field.
        internalAtom.__valdresOnMount
        internalAtom.__cacheMeta
        internalAtom.__cacheMetaSelector
        internalAtom.__valdresInternal
        internalSelector.__valdresOnMount
        internalSelector.__valdresInternal
        internalAtomFamily.__valdresOnMount
        internalAtomFamily.__valdresAtomFamilyMap
        internalSelectorFamily.__valdresSelectorFamilyMap
    }
})
