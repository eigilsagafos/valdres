import { describe, test, expect } from "bun:test"
import { mount, unmount, flushSync } from "svelte"
import { selector, store } from "valdres"
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
})
