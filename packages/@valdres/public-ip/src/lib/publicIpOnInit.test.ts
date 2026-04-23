import {
    describe,
    test,
    expect,
    afterEach,
    beforeAll,
    afterAll,
} from "bun:test"
import { store } from "valdres"
import { publicIpV4Atom } from "../atoms/publicIpV4Atom"
import { publicIpV4EndpointsAtom } from "../atoms/publicIpV4EndpointsAtom"
import { publicIpMaxAgeAtom } from "../atoms/publicIpMaxAgeAtom"
import { mockFetch } from "../../test/mockFetch"

const waitUntil = async (predicate: () => boolean, timeoutMs = 500) => {
    const start = Date.now()
    while (!predicate()) {
        if (Date.now() - start > timeoutMs)
            throw new Error("waitUntil timed out")
        await new Promise(r => setTimeout(r, 5))
    }
}

type ConnectionListener = () => void

interface FakeConnection {
    addEventListener: (type: "change", listener: ConnectionListener) => void
    removeEventListener: (type: "change", listener: ConnectionListener) => void
    emit: () => void
}

const installFakeConnection = (): FakeConnection => {
    const listeners = new Set<ConnectionListener>()
    const fake: FakeConnection = {
        addEventListener: (_type, listener) => void listeners.add(listener),
        removeEventListener: (_type, listener) =>
            void listeners.delete(listener),
        emit: () => {
            for (const l of listeners) l()
        },
    }
    Object.defineProperty(navigator, "connection", {
        configurable: true,
        value: fake,
    })
    return fake
}

const removeFakeConnection = () => {
    delete (navigator as any).connection
}

describe("publicIpOnInit", () => {
    const m = mockFetch()

    afterEach(() => {
        m.reset()
        publicIpV4Atom.resetSelf()
        publicIpV4EndpointsAtom.resetSelf()
        publicIpMaxAgeAtom.resetSelf()
    })

    test("refetches on window 'online' event", async () => {
        m.alwaysRespond("https://api.ipify.org", "203.0.113.10")
        const s = store()
        await s.get(publicIpV4Atom)
        s.sub(publicIpV4Atom, () => {})
        const before = m.calls.length
        window.dispatchEvent(new Event("online"))
        await waitUntil(() => m.calls.length > before)
        expect(m.calls.length).toBeGreaterThan(before)
    })

    test("refetches on document 'visibilitychange' when visible", async () => {
        m.alwaysRespond("https://api.ipify.org", "203.0.113.11")
        const s = store()
        await s.get(publicIpV4Atom)
        s.sub(publicIpV4Atom, () => {})
        const before = m.calls.length
        document.dispatchEvent(new Event("visibilitychange"))
        await waitUntil(() => m.calls.length > before)
        expect(m.calls.length).toBeGreaterThan(before)
    })

    describe("with a fake navigator.connection", () => {
        let fake: FakeConnection

        beforeAll(() => {
            fake = installFakeConnection()
        })

        afterAll(() => {
            removeFakeConnection()
        })

        test("refetches on connection 'change' event", async () => {
            m.alwaysRespond("https://api.ipify.org", "203.0.113.12")
            const s = store()
            await s.get(publicIpV4Atom)
            s.sub(publicIpV4Atom, () => {})
            const before = m.calls.length
            fake.emit()
            await waitUntil(() => m.calls.length > before)
            expect(m.calls.length).toBeGreaterThan(before)
        })
    })

    describe("when navigator.onLine is false", () => {
        let original: boolean

        beforeAll(() => {
            original = navigator.onLine
            Object.defineProperty(navigator, "onLine", {
                configurable: true,
                value: false,
            })
        })

        afterAll(() => {
            Object.defineProperty(navigator, "onLine", {
                configurable: true,
                value: original,
            })
        })

        test("does not refetch when signals fire", async () => {
            m.alwaysRespond("https://api.ipify.org", "203.0.113.13")
            const s = store()
            await s.get(publicIpV4Atom)
            s.sub(publicIpV4Atom, () => {})
            const before = m.calls.length
            window.dispatchEvent(new Event("online"))
            document.dispatchEvent(new Event("visibilitychange"))
            await new Promise(r => setTimeout(r, 50))
            expect(m.calls.length).toBe(before)
        })
    })
})
