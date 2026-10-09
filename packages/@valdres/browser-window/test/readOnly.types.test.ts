/**
 * Compile-time enforcement that the window size is read-only browser truth.
 * The `@ts-expect-error` directives fail `bun run typecheck:tests` if a future
 * change makes `windowSizeAtom` writable again or its snapshots mutable; the
 * runtime rejection is asserted in `src/atoms/windowSizeAtom.test.ts`.
 */
import { expect, test } from "bun:test"
import { store, type ExternalAtom, type Store } from "valdres"
import { windowSizeAtom, type WindowSize } from "../src/index"

const rejectedWrites = (app: Store, size: WindowSize) => {
    // @ts-expect-error an external source cannot be written
    app.set(windowSizeAtom, size)
    // @ts-expect-error an external source cannot be reset
    app.reset(windowSizeAtom)
    // @ts-expect-error an external source cannot be updated
    app.update(windowSizeAtom, () => size)
    // @ts-expect-error snapshots are shared between stores, so they are read-only
    size.innerWidth = 1
}

test("reads keep their declared value domain", () => {
    const app = store()
    const definition: ExternalAtom<WindowSize> = windowSizeAtom
    const size: WindowSize = app.get(definition)
    const width: number = size.innerWidth
    expect(typeof width).toBe("number")
    expect(typeof rejectedWrites).toBe("function")
    app.dispose()
})
