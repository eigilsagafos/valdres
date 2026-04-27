import {
    describe,
    test,
    expect,
    beforeEach,
    afterEach,
    afterAll,
} from "bun:test"
import { store } from "valdres"
import { publicIpV4Atom } from "../atoms/publicIpV4Atom"
import { publicIpV4EndpointsAtom } from "../atoms/publicIpV4EndpointsAtom"
import { publicIpV4StatusAtom } from "../atoms/publicIpV4StatusAtom"
import { publicIpV4ValueAtom } from "../atoms/publicIpV4ValueAtom"
import { publicIpV4ErrorAtom } from "../atoms/publicIpV4ErrorAtom"
import { publicIpStaleWhileRevalidateAtom } from "../atoms/publicIpStaleWhileRevalidateAtom"
import { publicIpStaleIfErrorAtom } from "../atoms/publicIpStaleIfErrorAtom"
import { publicIpMaxAgeAtom } from "../atoms/publicIpMaxAgeAtom"
import { mockFetch } from "../../test/mockFetch"

const waitUntil = async (predicate: () => boolean, timeoutMs = 1000) => {
    const start = Date.now()
    while (!predicate()) {
        if (Date.now() - start > timeoutMs)
            throw new Error("waitUntil timed out")
        await new Promise(r => setTimeout(r, 5))
    }
}

const resetAll = () => {
    publicIpV4Atom.resetSelf()
    publicIpV4EndpointsAtom.resetSelf()
    publicIpV4StatusAtom.resetSelf()
    publicIpV4ValueAtom.resetSelf()
    publicIpV4ErrorAtom.resetSelf()
    publicIpStaleWhileRevalidateAtom.resetSelf()
    publicIpStaleIfErrorAtom.resetSelf()
    publicIpMaxAgeAtom.resetSelf()
}

type Deferred = {
    resolve: (v: string) => void
    reject: (e: Error) => void
}

const installDeferredFetch = (deferreds: Deferred[]) => {
    const original = globalThis.fetch
    globalThis.fetch = (async () => {
        let resolve!: (v: string) => void
        let reject!: (e: Error) => void
        const body = new Promise<string>((res, rej) => {
            resolve = res
            reject = rej
        })
        deferreds.push({ resolve, reject })
        return {
            ok: true,
            status: 200,
            text: async () => body,
        }
    }) as typeof fetch
    return () => {
        globalThis.fetch = original
    }
}

describe("createPublicIpAtom", () => {
    const m = mockFetch()
    const unsubs: Array<() => void> = []

    beforeEach(() => {
        resetAll()
    })

    afterEach(() => {
        while (unsubs.length) unsubs.pop()!()
        m.reset()
        resetAll()
    })

    afterAll(() => m.restore())

    describe("status transitions", () => {
        test("idle → loading → ok", async () => {
            m.alwaysRespond("https://api4.ipify.org", "203.0.113.20")
            expect(publicIpV4StatusAtom.getSelf()).toBe("idle")
            const s = store()
            const p = s.get(publicIpV4Atom)
            expect(publicIpV4StatusAtom.getSelf()).toBe("loading")
            await p
            expect(publicIpV4StatusAtom.getSelf()).toBe("ok")
        })

        test("revalidating once a value is already cached", async () => {
            m.alwaysRespond("https://api4.ipify.org", "203.0.113.21")
            const s = store()
            await s.get(publicIpV4Atom)
            unsubs.push(s.sub(publicIpV4Atom, () => {}))
            window.dispatchEvent(new Event("online"))
            expect(publicIpV4StatusAtom.getSelf()).toBe("revalidating")
            await waitUntil(() => publicIpV4StatusAtom.getSelf() === "ok")
        })

        test("idle → loading → error when every endpoint fails", async () => {
            m.queue(new Error("network down"))
            m.queue(new Error("network down"))
            const s = store()
            await s.get(publicIpV4Atom).catch(() => {})
            expect(publicIpV4StatusAtom.getSelf()).toBe("error")
            expect(publicIpV4ErrorAtom.getSelf()).not.toBeNull()
        })
    })

    describe("value/error atoms", () => {
        test("valueAtom holds the resolved IP", async () => {
            m.alwaysRespond("https://api4.ipify.org", "203.0.113.22")
            const s = store()
            await s.get(publicIpV4Atom)
            expect(publicIpV4ValueAtom.getSelf()).toBe("203.0.113.22")
        })

        test("errorAtom clears on success after a previous failure", async () => {
            m.queue(new Error("network down"))
            m.queue(new Error("network down"))
            const s = store()
            await s.get(publicIpV4Atom).catch(() => {})
            expect(publicIpV4ErrorAtom.getSelf()).not.toBeNull()

            m.reset()
            m.alwaysRespond("https://api4.ipify.org", "203.0.113.23")
            publicIpV4Atom.resetSelf()
            await s.get(publicIpV4Atom)
            expect(publicIpV4ErrorAtom.getSelf()).toBeNull()
            expect(publicIpV4StatusAtom.getSelf()).toBe("ok")
        })

        test("staleWhileRevalidate=0 nulls valueAtom during revalidation", async () => {
            publicIpStaleWhileRevalidateAtom.setSelf(0)
            m.alwaysRespond("https://api4.ipify.org", "203.0.113.24")
            const s = store()
            await s.get(publicIpV4Atom)
            unsubs.push(s.sub(publicIpV4Atom, () => {}))
            expect(publicIpV4ValueAtom.getSelf()).toBe("203.0.113.24")
            window.dispatchEvent(new Event("online"))
            expect(publicIpV4ValueAtom.getSelf()).toBeNull()
            expect(publicIpV4StatusAtom.getSelf()).toBe("loading")
        })

        test("staleIfError=0 nulls valueAtom on failed revalidation", async () => {
            publicIpStaleIfErrorAtom.setSelf(0)
            m.alwaysRespond("https://api4.ipify.org", "203.0.113.25")
            const s = store()
            await s.get(publicIpV4Atom)
            unsubs.push(s.sub(publicIpV4Atom, () => {}))
            expect(publicIpV4ValueAtom.getSelf()).toBe("203.0.113.25")

            m.reset()
            m.queue(new Error("network down"))
            m.queue(new Error("network down"))
            window.dispatchEvent(new Event("online"))
            await waitUntil(
                () => publicIpV4StatusAtom.getSelf() === "error",
            )
            expect(publicIpV4ValueAtom.getSelf()).toBeNull()
            expect(publicIpV4ErrorAtom.getSelf()).not.toBeNull()
        })

        test("staleIfError>0 keeps valueAtom on failed revalidation", async () => {
            m.alwaysRespond("https://api4.ipify.org", "203.0.113.26")
            const s = store()
            await s.get(publicIpV4Atom)
            unsubs.push(s.sub(publicIpV4Atom, () => {}))
            expect(publicIpV4ValueAtom.getSelf()).toBe("203.0.113.26")

            m.reset()
            m.queue(new Error("network down"))
            m.queue(new Error("network down"))
            window.dispatchEvent(new Event("online"))
            await waitUntil(
                () => publicIpV4StatusAtom.getSelf() === "error",
            )
            expect(publicIpV4ValueAtom.getSelf()).toBe("203.0.113.26")
            expect(publicIpV4ErrorAtom.getSelf()).not.toBeNull()
        })
    })

    describe("stale-resolution race", () => {
        test("an older fetch resolving after a newer one does not overwrite atoms", async () => {
            publicIpV4EndpointsAtom.setSelf(["https://api4.ipify.org"])
            const deferreds: Deferred[] = []
            const restore = installDeferredFetch(deferreds)
            try {
                const s = store()
                const initial = s.get(publicIpV4Atom) as Promise<string>
                unsubs.push(s.sub(publicIpV4Atom, () => {}))
                const beforeEvent = deferreds.length
                window.dispatchEvent(new Event("online"))
                await waitUntil(() => deferreds.length > beforeEvent)
                const newestIdx = deferreds.length - 1

                deferreds[newestIdx].resolve("203.0.113.99")
                await new Promise(r => setTimeout(r, 50))
                expect(publicIpV4ValueAtom.getSelf()).toBe("203.0.113.99")
                expect(publicIpV4StatusAtom.getSelf()).toBe("ok")

                for (let i = 0; i < newestIdx; i++) {
                    deferreds[i].resolve("198.51.100.99")
                }
                await new Promise(r => setTimeout(r, 50))
                expect(publicIpV4ValueAtom.getSelf()).toBe("203.0.113.99")
                expect(publicIpV4StatusAtom.getSelf()).toBe("ok")

                await initial.catch(() => {})
            } finally {
                restore()
            }
        })

        test("an older fetch rejecting after a newer one succeeds keeps status ok and error null", async () => {
            publicIpV4EndpointsAtom.setSelf(["https://api4.ipify.org"])
            const deferreds: Deferred[] = []
            const restore = installDeferredFetch(deferreds)
            try {
                const s = store()
                const initial = s.get(publicIpV4Atom) as Promise<string>
                unsubs.push(s.sub(publicIpV4Atom, () => {}))
                const beforeEvent = deferreds.length
                window.dispatchEvent(new Event("online"))
                await waitUntil(() => deferreds.length > beforeEvent)
                const newestIdx = deferreds.length - 1

                deferreds[newestIdx].resolve("203.0.113.77")
                await new Promise(r => setTimeout(r, 50))
                expect(publicIpV4StatusAtom.getSelf()).toBe("ok")
                expect(publicIpV4ErrorAtom.getSelf()).toBeNull()

                for (let i = 0; i < newestIdx; i++) {
                    deferreds[i].reject(new Error("stale failure"))
                }
                await new Promise(r => setTimeout(r, 50))
                expect(publicIpV4StatusAtom.getSelf()).toBe("ok")
                expect(publicIpV4ErrorAtom.getSelf()).toBeNull()

                await initial.catch(() => {})
            } finally {
                restore()
            }
        })
    })
})
