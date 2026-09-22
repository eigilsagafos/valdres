/**
 * Compile-time enforcement that the preference is read-only browser truth.
 * The `@ts-expect-error` directives fail `bun run typecheck:tests` if a future
 * change ever makes `reducedMotionAtom` writable again. They live inside a
 * function that is never called: the point is that they do not compile, and
 * the runtime rejection is asserted separately in
 * `src/atoms/reducedMotionAtom.test.ts`.
 */
import { expect, test } from "bun:test"
import { store, type Store } from "valdres"
import {
    reducedMotionAtom,
    prefersReducedMotionSelector,
    type ReducedMotion,
} from "../src/index"

const rejectedWrites = (app: Store) => {
    // @ts-expect-error an external source cannot be written
    app.set(reducedMotionAtom, "reduce")
    // @ts-expect-error an external source cannot be reset
    app.reset(reducedMotionAtom)
    // @ts-expect-error an external source cannot be updated
    app.update(reducedMotionAtom, () => "reduce")
    // @ts-expect-error derived selectors are not writable either
    app.set(prefersReducedMotionSelector, true)
}

test("reads keep their declared value domains", () => {
    const app = store()
    const preference: ReducedMotion = app.get(reducedMotionAtom)
    const reduced: boolean = app.get(prefersReducedMotionSelector)
    expect([preference, reduced]).toEqual(["no-preference", false])
    expect(typeof rejectedWrites).toBe("function")
    app.dispose()
})
