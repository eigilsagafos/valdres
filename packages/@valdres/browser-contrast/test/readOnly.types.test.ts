/**
 * Compile-time enforcement that the preference is read-only browser truth.
 * The `@ts-expect-error` directives fail `bun run typecheck:tests` if a future
 * change ever makes `contrastAtom` writable again. They live inside a function
 * that is never called: the point is that they do not compile, and the runtime
 * rejection is asserted separately in `src/atoms/contrastAtom.test.ts`.
 */
import { expect, test } from "bun:test"
import { store, type Store } from "valdres"
import {
    contrastAtom,
    prefersMoreContrastSelector,
    type Contrast,
} from "../src/index"

const rejectedWrites = (app: Store) => {
    // @ts-expect-error an external source cannot be written
    app.set(contrastAtom, "more")
    // @ts-expect-error an external source cannot be reset
    app.reset(contrastAtom)
    // @ts-expect-error an external source cannot be updated
    app.update(contrastAtom, () => "more")
    // @ts-expect-error derived selectors are not writable either
    app.set(prefersMoreContrastSelector, true)
}

test("reads keep their declared value domains", () => {
    const app = store()
    const contrast: Contrast = app.get(contrastAtom)
    const more: boolean = app.get(prefersMoreContrastSelector)
    expect([contrast, more]).toEqual(["no-preference", false])
    expect(typeof rejectedWrites).toBe("function")
    app.dispose()
})
