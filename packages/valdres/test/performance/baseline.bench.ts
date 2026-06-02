import { describe, test } from "./test-compat"
import { atom as valdresAtom } from "../../src/atom"
import { store as valdresCreateStore } from "../../src/store"
import { compare } from "./bench-utils"

// Native-floor comparisons: how close is valdres to a raw JS Map on the core
// key→value operations? Emitted as a `ratio` (valdres / map) — a fixed
// yardstick, not a competitor. Bencher gates the *drift* of this ratio, so we
// catch valdres pulling away from raw JS over time.
//
// Op names intentionally match the vs-jotai benchmarks (atom.bench.ts) so the
// absolute `latency` series line up ("store.get(atom) / valdres" etc.) and the
// ratio view reads "store.get(atom) · valdres vs {jotai,map}" side by side.
//
// The maxSlowerRatio is a loose local guard only (valdres is ~tens× a raw Map,
// which is expected) — the real gate is Bencher's percentage threshold on the
// `ratio` measure, which alerts on drift rather than absolute level.

let sink: any

describe("native floor (vs raw Map)", () => {
    test("store.get(atom) vs map.get", async () => {
        const map = new Map([["key", "hello"]])
        const vStore = valdresCreateStore()
        const vAtom = valdresAtom("hello")
        vStore.get(vAtom)

        await compare(
            "store.get(atom)",
            () => {
                sink = vStore.get(vAtom)
            },
            () => {
                sink = map.get("key")
            },            "map",
        )
    })

    test("set(atom, value) vs map.set", async () => {
        const map = new Map([["key", 0]])
        const vStore = valdresCreateStore()
        const vAtom = valdresAtom(0)

        let vi = 0
        let mi = 0
        await compare(
            "set(atom, value)",
            () => vStore.set(vAtom, ++vi),
            () => map.set("key", ++mi),            "map",
        )
    })
})
