/**
 * Compile-time enforcement that the preference is read-only browser truth.
 * The `@ts-expect-error` directives fail `bun run typecheck:tests` if a future
 * change ever makes `reducedDataAtom` writable again. They live inside a
 * function that is never called: the point is that they do not compile, and
 * the runtime rejection is asserted separately in
 * `src/atoms/reducedDataAtom.test.ts`.
 */
import { expect, test } from "bun:test"
import { store, type Store } from "valdres"
import {
    reducedDataAtom,
    prefersReducedDataSelector,
    type ReducedData,
} from "../src/index"

const rejectedWrites = (app: Store) => {
    // @ts-expect-error an external source cannot be written
    app.set(reducedDataAtom, "reduce")
    // @ts-expect-error an external source cannot be reset
    app.reset(reducedDataAtom)
    // @ts-expect-error an external source cannot be updated
    app.update(reducedDataAtom, () => "reduce")
    // @ts-expect-error derived selectors are not writable either
    app.set(prefersReducedDataSelector, true)
}

test("reads keep their declared value domains", () => {
    const app = store()
    const preference: ReducedData = app.get(reducedDataAtom)
    const reduced: boolean = app.get(prefersReducedDataSelector)
    expect([preference, reduced]).toEqual(["no-preference", false])
    expect(typeof rejectedWrites).toBe("function")
    app.dispose()
})
