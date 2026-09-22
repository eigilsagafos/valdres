/**
 * Compile-time enforcement that the OS preference is read-only browser truth.
 * The `@ts-expect-error` directives fail `bun run typecheck:tests` if a future
 * change ever makes `colorSchemeAtom` writable again. They live inside a
 * function that is never called: the point is that they do not compile, and
 * the runtime rejection is asserted separately in
 * `src/atoms/colorSchemeAtom.test.ts`.
 */
import { expect, test } from "bun:test"
import { store, type Store } from "valdres"
import { colorSchemeAtom, isDarkSelector, type ColorScheme } from "../src/index"

const rejectedWrites = (app: Store) => {
    // @ts-expect-error an external source cannot be written
    app.set(colorSchemeAtom, "dark")
    // @ts-expect-error an external source cannot be reset
    app.reset(colorSchemeAtom)
    // @ts-expect-error an external source cannot be updated
    app.update(colorSchemeAtom, () => "dark")
    // @ts-expect-error derived selectors are not writable either
    app.set(isDarkSelector, true)
}

test("reads keep their declared value domains", () => {
    const app = store()
    const scheme: ColorScheme = app.get(colorSchemeAtom)
    const dark: boolean = app.get(isDarkSelector)
    expect([scheme, dark]).toEqual(["light", false])
    expect(typeof rejectedWrites).toBe("function")
    app.dispose()
})
