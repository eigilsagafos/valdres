/**
 * Compile-time enforcement that the preference is read-only browser truth.
 * The `@ts-expect-error` directives fail `bun run typecheck:tests` if a future
 * change ever makes `reducedTransparencyAtom` writable again. They live inside a
 * function that is never called: the point is that they do not compile, and
 * the runtime rejection is asserted separately in
 * `src/atoms/reducedTransparencyAtom.test.ts`.
 */
import { expect, test } from "bun:test"
import { store, type Store } from "valdres"
import {
    reducedTransparencyAtom,
    prefersReducedTransparencySelector,
    type ReducedTransparency,
} from "../src/index"

const rejectedWrites = (app: Store) => {
    // @ts-expect-error an external source cannot be written
    app.set(reducedTransparencyAtom, "reduce")
    // @ts-expect-error an external source cannot be reset
    app.reset(reducedTransparencyAtom)
    // @ts-expect-error an external source cannot be updated
    app.update(reducedTransparencyAtom, () => "reduce")
    // @ts-expect-error derived selectors are not writable either
    app.set(prefersReducedTransparencySelector, true)
}

test("reads keep their declared value domains", () => {
    const app = store()
    const preference: ReducedTransparency = app.get(reducedTransparencyAtom)
    const reduced: boolean = app.get(prefersReducedTransparencySelector)
    expect([preference, reduced]).toEqual(["no-preference", false])
    expect(typeof rejectedWrites).toBe("function")
    app.dispose()
})
