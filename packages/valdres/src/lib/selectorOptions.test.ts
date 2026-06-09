import { describe, expect, test } from "bun:test"
import { selector } from "../selector"
import { store } from "../store"

// Regression guard for the options-allocation fast path in evaluateSelector.
// Selectors whose `get` has arity < 2 reuse a shared per-store options object
// (the "fast path") instead of building a per-eval one (the "full path",
// arity >= 2). Either way the selector must receive a correct `options`: the
// real `storeId` and a valid `signal` (a non-abortable placeholder on the fast
// path). The arity-1 cases below cover the patterns where `get.length` is 1 but
// the body still reaches the options object.
describe("selector options object", () => {
    test("full path (arity 2): options.storeId is the real store id", () => {
        const s = store()
        const sel = selector((_get, opts) => opts.storeId)
        expect(s.get(sel)).toBe(s.data.id)
    })

    // `opts = {}` / rest params make `get.length === 1`, so the selector takes
    // the fast path — but must still see the real storeId, never `undefined`.
    test("fast path (defaulted options param): real store id", () => {
        const s = store()
        const sel = selector((_get, opts: any = {}) => opts.storeId)
        expect(s.get(sel)).toBe(s.data.id)
    })

    test("fast path (rest options param): real store id", () => {
        const s = store()
        const sel = selector((_get, ...rest: any[]) => rest[0].storeId)
        expect(s.get(sel)).toBe(s.data.id)
    })

    test("fast path: signal is a valid, non-aborted placeholder", () => {
        const s = store()
        const sel = selector((_get, opts: any = {}) => opts.signal.aborted)
        expect(s.get(sel)).toBe(false)
    })

    test("fast path: each store reading storeId gets its own id", () => {
        const a = store()
        const b = store()
        const sel = selector((_get, opts: any = {}) => opts.storeId)
        expect(a.get(sel)).toBe(a.data.id)
        expect(b.get(sel)).toBe(b.data.id)
        expect(a.data.id).not.toBe(b.data.id)
    })
})
