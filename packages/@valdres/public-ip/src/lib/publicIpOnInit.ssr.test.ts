import { describe, test, expect, beforeAll, afterAll } from "bun:test"
import { GlobalRegistrator } from "@happy-dom/global-registrator"
import { store } from "valdres"
import { publicIpV4Atom } from "../atoms/publicIpV4Atom"
import { publicIpV4EndpointsAtom } from "../atoms/publicIpV4EndpointsAtom"
import { publicIpMaxAgeAtom } from "../atoms/publicIpMaxAgeAtom"
import { mockFetch } from "../../test/mockFetch"

describe("publicIpOnInit (SSR / no browser APIs)", () => {
    let m: ReturnType<typeof mockFetch>

    beforeAll(() => {
        publicIpV4Atom.resetSelf()
        GlobalRegistrator.unregister()
        m = mockFetch()
    })

    afterAll(() => {
        m.reset()
        publicIpV4Atom.resetSelf()
        publicIpV4EndpointsAtom.resetSelf()
        publicIpMaxAgeAtom.resetSelf()
        GlobalRegistrator.register()
    })

    test("fetches without throwing when window/document are undefined", async () => {
        expect(typeof window).toBe("undefined")
        expect(typeof document).toBe("undefined")

        m.alwaysRespond("https://api.ipify.org", "203.0.113.42")
        const s = store()
        expect(await s.get(publicIpV4Atom)).toBe("203.0.113.42")
    })
})
