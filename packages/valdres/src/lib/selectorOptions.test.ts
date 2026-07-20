import { describe, expect, test } from "bun:test"
import { selector } from "../selector"
import { store } from "../store"

// Selector options are valid regardless of the callback's reported arity.
// Default and rest parameters make Function.length unsuitable for deciding
// whether a selector can use its options object.
describe("selector options object", () => {
    test("options.storeId is the real store id", () => {
        const s = store()
        const sel = selector((_get, opts) => opts.storeId)
        expect(s.get(sel)).toBe(s.id)
    })

    test("defaulted options param receives the real store id", () => {
        const s = store()
        const sel = selector((_get, opts: any = {}) => opts.storeId)
        expect(s.get(sel)).toBe(s.id)
    })

    test("rest options param receives the real store id", () => {
        const s = store()
        const sel = selector((_get, ...rest: any[]) => rest[0].storeId)
        expect(s.get(sel)).toBe(s.id)
    })

    test("defaulted options param receives a valid signal", () => {
        const s = store()
        const sel = selector((_get, opts: any = {}) => opts.signal.aborted)
        expect(s.get(sel)).toBe(false)
    })

    test("each store reading storeId gets its own id", () => {
        const a = store()
        const b = store()
        const sel = selector((_get, opts: any = {}) => opts.storeId)
        expect(a.get(sel)).toBe(a.id)
        expect(b.get(sel)).toBe(b.id)
        expect(a.id).not.toBe(b.id)
    })
})
