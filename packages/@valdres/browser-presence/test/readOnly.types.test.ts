/**
 * Compile-time enforcement that presence is a read-only derivation. The
 * `@ts-expect-error` directive fails `bun run typecheck:tests` if a future
 * change makes `presenceSelector` writable; the runtime rejection is asserted
 * in `src/selectors/presenceSelector.test.ts`.
 */
import { expect, test } from "bun:test"
import { store, type Selector, type Store } from "valdres"
import { presenceSelector } from "../src/index"

const rejectedWrites = (app: Store) => {
    // @ts-expect-error a derived selector cannot be written
    app.set(presenceSelector, false)
}

test("reads keep their declared value domain", () => {
    const app = store()
    const definition: Selector<boolean> = presenceSelector
    const present: boolean = app.get(definition)
    expect(typeof present).toBe("boolean")
    expect(typeof rejectedWrites).toBe("function")
    app.dispose()
})
