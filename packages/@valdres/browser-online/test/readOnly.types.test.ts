/**
 * Compile-time enforcement that connectivity is read-only browser truth. The
 * `@ts-expect-error` directives fail `bun run typecheck:tests` if a future
 * change makes `onlineAtom` writable again; the runtime rejection is asserted
 * in `src/atoms/onlineAtom.test.ts`.
 */
import { expect, test } from "bun:test"
import { store, type ExternalAtom, type Store } from "valdres"
import { onlineAtom } from "../src/index"

const rejectedWrites = (app: Store) => {
    // @ts-expect-error an external source cannot be written
    app.set(onlineAtom, false)
    // @ts-expect-error an external source cannot be reset
    app.reset(onlineAtom)
    // @ts-expect-error an external source cannot be updated
    app.update(onlineAtom, () => false)
}

test("reads keep their declared value domain", () => {
    const app = store()
    const definition: ExternalAtom<boolean> = onlineAtom
    const online: boolean = app.get(definition)
    expect(typeof online).toBe("boolean")
    expect(typeof rejectedWrites).toBe("function")
    app.dispose()
})
