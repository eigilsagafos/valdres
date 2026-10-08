/**
 * The behavior the atom, selector and compatibility pages describe, executed
 * against the current core, with the page examples as written. The option
 * bags and write signatures are checked at the type level in
 * claims/core-options.types.ts.
 */
import { describe, expect, test } from "bun:test"
import { join } from "node:path"
import { atom, selector, store } from "../../packages/valdres/src/index.ts"
import { deepEqual } from "../../packages/valdres/src/equality.ts"

const counter = () => {
    let calls = 0
    return { notify: () => void calls++, get calls() { return calls } }
}

describe("values are shared by reference", () => {
    test("store.get, selectors and subscribers see the written reference, never copied or frozen", () => {
        const app = store()
        const value = { list: [1] }
        const valueAtom = atom(value)
        const passthrough = selector(get => get(valueAtom))
        expect(app.get(valueAtom)).toBe(value)
        expect(app.get(passthrough)).toBe(value)
        expect(Object.isFrozen(app.get(valueAtom))).toBe(false)
        expect(Object.isFrozen(app.get(valueAtom).list)).toBe(false)

        const computed = selector(get => ({ list: [...get(valueAtom).list] }))
        expect(Object.isFrozen(app.get(computed))).toBe(false)
    })

    test("built-ins and host objects are stored as-is", () => {
        const app = store()
        const map = new Map([[1, 1]])
        const bytes = new Uint8Array([1])
        expect(app.get(atom(map))).toBe(map)
        expect(app.get(atom(bytes))).toBe(bytes)
    })

    test("the page's unsupported in-place mutation notifies no one; update does", () => {
        type Todo = { title: string }
        const myStore = store()
        const todosAtom = atom<Todo[]>([])
        const todo = { title: "Write docs" }
        const subscriber = counter()
        myStore.sub(todosAtom, subscriber.notify)

        // Unsupported: mutates the shared array and notifies no one
        myStore.get(todosAtom).push(todo)
        myStore.set(todosAtom, myStore.get(todosAtom))
        expect(subscriber.calls).toBe(0)

        // Supported: write a new array
        myStore.update(todosAtom, todos => [...todos, todo])
        expect(subscriber.calls).toBe(1)
    })
})

describe("equality", () => {
    test("Object.is is the default: a structurally equal replacement notifies", () => {
        const app = store()
        const pointAtom = atom({ x: 1 })
        const doubled = selector(get => ({ x: get(pointAtom).x * 2 }))
        const atomSubscriber = counter()
        const selectorSubscriber = counter()
        app.sub(pointAtom, atomSubscriber.notify)
        app.sub(doubled, selectorSubscriber.notify)
        app.set(pointAtom, { x: 1 })
        expect(atomSubscriber.calls).toBe(1)
        expect(selectorSubscriber.calls).toBe(1)
    })

    test("deepEqual from valdres/equality keeps the previous reference and skips the notification", () => {
        const app = store()
        const documentAtom = atom({ blocks: [] as number[] }, { equal: deepEqual })
        const visible = selector(get => get(documentAtom).blocks.filter(Boolean), { equal: deepEqual })
        const before = app.get(documentAtom)
        const beforeVisible = app.get(visible)
        const subscriber = counter()
        app.sub(documentAtom, subscriber.notify)
        app.sub(visible, () => {})
        app.set(documentAtom, { blocks: [] })
        expect(subscriber.calls).toBe(0)
        expect(app.get(documentAtom)).toBe(before)
        expect(app.get(visible)).toBe(beforeVisible)
    })

    test("valdres/equality stays a separate entry", async () => {
        const root = await import("../../packages/valdres/src/index.ts")
        expect("deepEqual" in root).toBe(false)
        expect("deepFreeze" in root).toBe(false)
    })
})

describe("writing", () => {
    test("set stores a value, update invokes an updater, reset restores the initial value", () => {
        const myStore = store()
        const countAtom = atom(0)
        myStore.set(countAtom, 42)
        expect(myStore.get(countAtom)).toBe(42)
        myStore.update(countAtom, count => count + 1)
        expect(myStore.get(countAtom)).toBe(43)
        myStore.reset(countAtom)
        expect(myStore.get(countAtom)).toBe(0)
    })

    test("atom(fn) and set(atom, fn) store the function itself", () => {
        const app = store()
        const fn = () => 0
        const fnAtom = atom(fn)
        expect(app.get(fnAtom)).toBe(fn)
        const next = () => 1
        app.set(fnAtom, next)
        expect(app.get(fnAtom)).toBe(next)
    })

    test("atom.lazy runs its initializer once per Store, on first read, and rejects Promises", () => {
        let calls = 0
        const settingsAtom = atom.lazy(() => {
            calls++
            return { theme: "dark" }
        })
        const first = store()
        expect(calls).toBe(0)
        first.get(settingsAtom)
        first.get(settingsAtom)
        expect(calls).toBe(1)
        store().get(settingsAtom)
        expect(calls).toBe(2)

        const asyncAtom = atom.lazy(() => Promise.resolve(1) as unknown as number)
        expect(() => store().get(asyncAtom)).toThrow(
            expect.objectContaining({ name: "InvalidSynchronousAtomValueError" }),
        )
    })

    test("a selector returning a Promise throws on read", () => {
        const asyncSelector = selector(() => Promise.resolve(1))
        expect(() => store().get(asyncSelector)).toThrow(
            expect.objectContaining({ code: "VALDRES_INVALID_SYNCHRONOUS_SELECTOR_RESULT" }),
        )
    })
})

test("the documented option bags and write signatures typecheck", () => {
    const tsgo = join(import.meta.dir, "../../node_modules/.bin/tsgo")
    const result = Bun.spawnSync(
        [tsgo, "--noEmit", "--singleThreaded", "-p", join(import.meta.dir, "claims/tsconfig.json")],
        { stdout: "pipe", stderr: "pipe" },
    )
    expect(result.stdout.toString() + result.stderr.toString()).toBe("")
    expect(result.exitCode).toBe(0)
})
