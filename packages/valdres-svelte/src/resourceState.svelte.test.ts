import { describe, test, expect } from "bun:test"
import { mount, unmount, flushSync } from "svelte"
import { atom, selector, store } from "valdres"
import ResourceProbe from "../test/components/ResourceProbe.svelte"

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

describe("resourceState (mounted)", () => {
    test("transitions loading → resolved value", async () => {
        const asyncSel = selector(() => tick().then(() => "hello"))
        const s = store()
        const target = document.createElement("div")
        const comp = mount(ResourceProbe, {
            target,
            props: { selector: asyncSel, store: s },
        })

        expect(target.querySelector(".loading")!.textContent).toBe("true")
        expect(target.querySelector(".value")!.textContent).toBe("")

        await tick()
        await tick()
        flushSync()

        expect(target.querySelector(".loading")!.textContent).toBe("false")
        expect(target.querySelector(".value")!.textContent).toBe("hello")

        unmount(comp)
    })

    test("captures a rejection in error", async () => {
        const failingSel = selector(() =>
            tick().then(() => {
                throw new Error("boom")
            }),
        )
        const s = store()
        const target = document.createElement("div")
        const comp = mount(ResourceProbe, {
            target,
            props: { selector: failingSel, store: s },
        })

        await tick()
        await tick()
        flushSync()

        expect(target.querySelector(".loading")!.textContent).toBe("false")
        expect(target.querySelector(".error")!.textContent).toContain("boom")

        unmount(comp)
    })

    test("re-enters loading and resolves the new value when a dependency changes", async () => {
        const idAtom = atom(1)
        const userSel = selector(get => {
            const id = get(idAtom)
            return tick().then(() => `user-${id}`)
        })
        const s = store()
        const target = document.createElement("div")
        const comp = mount(ResourceProbe, {
            target,
            props: { selector: userSel, store: s },
        })

        await tick()
        await tick()
        flushSync()
        expect(target.querySelector(".value")!.textContent).toBe("user-1")
        expect(target.querySelector(".loading")!.textContent).toBe("false")

        // Changing a dependency re-evaluates the selector → a fresh pending
        // promise → the box must re-enter the loading state.
        s.set(idAtom, 2)
        flushSync()
        expect(target.querySelector(".loading")!.textContent).toBe("true")
        expect(target.querySelector(".value")!.textContent).toBe("")

        await tick()
        await tick()
        flushSync()
        expect(target.querySelector(".loading")!.textContent).toBe("false")
        expect(target.querySelector(".value")!.textContent).toBe("user-2")

        unmount(comp)
    })

    test("a synchronous (non-promise) selector resolves immediately", () => {
        const syncSel = selector(() => "ready")
        const s = store()
        const target = document.createElement("div")
        const comp = mount(ResourceProbe, {
            target,
            props: { selector: syncSel, store: s },
        })
        flushSync()

        expect(target.querySelector(".loading")!.textContent).toBe("false")
        expect(target.querySelector(".value")!.textContent).toBe("ready")
        expect(target.querySelector(".error")!.textContent).toBe("")

        unmount(comp)
    })
})
