/**
 * Compile-time enforcement that page visibility is read-only browser truth.
 * The `@ts-expect-error` directives fail `bun run typecheck:tests` if a future
 * change makes either export writable; the runtime rejection is asserted in
 * `src/atoms/visibilityAtom.test.ts`.
 */
import { expect, test } from "bun:test"
import { store, type ExternalAtom, type Selector, type Store } from "valdres"
import {
    isVisibleSelector,
    visibilityAtom,
    type PageVisibility,
} from "../src/index"

const rejectedWrites = (app: Store) => {
    // @ts-expect-error an external source cannot be written
    app.set(visibilityAtom, "hidden")
    // @ts-expect-error an external source cannot be reset
    app.reset(visibilityAtom)
    // @ts-expect-error an external source cannot be updated
    app.update(visibilityAtom, () => "hidden")
    // @ts-expect-error derived selectors are not writable either
    app.set(isVisibleSelector, true)
}

// The package's own union stays assignable both ways to the DOM's, so
// consumers that typed against `DocumentVisibilityState` keep compiling.
const fromDom = (state: DocumentVisibilityState): PageVisibility => state
const toDom = (state: PageVisibility): DocumentVisibilityState => state

test("reads keep their declared value domains", () => {
    const app = store()
    const atom: ExternalAtom<PageVisibility> = visibilityAtom
    const selector: Selector<boolean> = isVisibleSelector
    const state: PageVisibility = app.get(atom)
    const visible: boolean = app.get(selector)
    expect([state, visible]).toEqual(["visible", true])
    expect([typeof rejectedWrites, typeof fromDom, typeof toDom]).toEqual([
        "function",
        "function",
        "function",
    ])
    app.dispose()
})
