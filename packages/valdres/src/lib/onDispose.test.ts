import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { store } from "../store"

/**
 * `store.onDispose` exists for the resources a consumer owns ALONGSIDE a store —
 * an adapter's per-scope cache, a subscription to something external, a timer —
 * which have to be released when the store they belong to dies.
 *
 * The gap it closes: a scope dies when its LAST lease detaches, or when any
 * ancestor is disposed. A consumer holding one lease can observe neither, so
 * before this the only way to know was to infer it (re-check `hasScope` on the
 * next acquire and reconcile), which gets the recreated-scope case wrong.
 */

describe("store.onDispose", () => {
    test("fires when the last lease detaches, not the first", () => {
        const root = store()
        const first = root.scope("draft")
        const second = root.scope("draft")

        const fired: string[] = []
        first.onDispose(() => fired.push("disposed"))

        first.detach()
        expect(fired).toStrictEqual([])

        second.detach()
        expect(fired).toStrictEqual(["disposed"])
    })

    test("fires for a scope when an ancestor is disposed", () => {
        const root = store()
        const draft = root.scope("draft")
        const nested = draft.scope("nested")

        const fired: string[] = []
        draft.onDispose(() => fired.push("draft"))
        nested.onDispose(() => fired.push("nested"))

        root.dispose()

        expect(fired.sort()).toStrictEqual(["draft", "nested"])
    })

    test("fires on a root store's own dispose", () => {
        const root = store()
        const fired: string[] = []
        root.onDispose(() => fired.push("root"))

        root.dispose()

        expect(fired).toStrictEqual(["root"])
    })

    test("returns an unsubscribe that cancels the callback", () => {
        const root = store()
        const fired: string[] = []
        const cancel = root.onDispose(() => fired.push("root"))

        cancel()
        root.dispose()

        expect(fired).toStrictEqual([])
    })

    test("fires exactly once, and not again on a repeated dispose", () => {
        const root = store()
        let count = 0
        root.onDispose(() => count++)

        root.dispose()
        root.dispose()

        expect(count).toBe(1)
    })

    test("several callbacks all run, in registration order", () => {
        const root = store()
        const fired: string[] = []
        root.onDispose(() => fired.push("a"))
        root.onDispose(() => fired.push("b"))
        root.onDispose(() => fired.push("c"))

        root.dispose()

        expect(fired).toStrictEqual(["a", "b", "c"])
    })

    test("one throwing callback does not strand the others", () => {
        const root = store()
        const fired: string[] = []
        root.onDispose(() => fired.push("before"))
        root.onDispose(() => {
            throw new Error("cleanup blew up")
        })
        root.onDispose(() => fired.push("after"))

        // The error surfaces to whoever called dispose, but every callback ran.
        expect(() => root.dispose()).toThrow("cleanup blew up")
        expect(fired).toStrictEqual(["before", "after"])
    })

    test("a callback may release state keyed by the dying scope", () => {
        // The motivating shape: an adapter holding per-scope state outside the
        // store, which must not survive into a scope that reuses the id.
        const registry = new Map<string, string>()
        const seeded = atom("unseeded")
        const root = store()

        const open = (ref: string) => {
            const scope = root.scope(ref)
            if (!registry.has(ref)) {
                registry.set(ref, "base")
                scope.set(seeded, "seeded")
                scope.onDispose(() => registry.delete(ref))
            }
            return scope
        }

        const first = open("cs")
        expect(registry.get("cs")).toBe("base")
        first.detach()
        expect(registry.has("cs")).toBe(false)

        // A scope reusing the id is genuinely new, and gets seeded again.
        const second = open("cs")
        expect(second.get(seeded)).toBe("seeded")
        second.detach()
    })

    test("throws on an already-disposed store", () => {
        const root = store()
        root.dispose()
        expect(() => root.onDispose(() => {})).toThrow(/disposed/i)
    })
})
