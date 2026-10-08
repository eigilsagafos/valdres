/**
 * Compile-time enforcement that focus is read-only browser truth. The
 * `@ts-expect-error` directives fail `bun run typecheck:tests` if a future
 * change makes `focusAtom` writable again; the runtime rejection is asserted in
 * `src/atoms/focusAtom.test.ts`.
 */
import { expect, test } from "bun:test"
import { store, type ExternalAtom, type Store } from "valdres"
import { focusAtom } from "../src/index"

const rejectedWrites = (app: Store) => {
    // @ts-expect-error an external source cannot be written
    app.set(focusAtom, false)
    // @ts-expect-error an external source cannot be reset
    app.reset(focusAtom)
    // @ts-expect-error an external source cannot be updated
    app.update(focusAtom, () => false)
}

test("reads keep their declared value domain", () => {
    const app = store()
    const definition: ExternalAtom<boolean> = focusAtom
    const focused: boolean = app.get(definition)
    expect(typeof focused).toBe("boolean")
    expect(typeof rejectedWrites).toBe("function")
    app.dispose()
})
