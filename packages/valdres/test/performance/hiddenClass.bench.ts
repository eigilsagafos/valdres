// Microbenchmark for the hidden-class refactor. Atoms used to be ad-hoc
// object literals whose field ordering depended on the spread of caller
// options — every option combination produced a distinct hidden class
// and every property read against options-bearing atoms in the wild was
// megamorphic.
//
// The factories now produce a single shape per option-bearing kind:
// one for options-bearing atoms, one for options-bearing selectors. The
// no-options fast paths still emit a minimal 2-field literal (matching
// the pre-refactor shape) so cold-create stays at V8's escape-friendly
// fast path. Two hidden classes per kind in the wild — polymorphic-but-
// cached, not megamorphic.
//
// The benchmarks below exercise the with-options path: each test
// constructs N atoms/selectors from distinct option combinations, then
// reads `.equal` in a tight loop. Pre-refactor the IC went megamorphic
// (N shapes); post-refactor it stays monomorphic against one shared
// shape.
import { describe, test } from "./test-compat"
import { atom } from "../../src/atom"
import { selector } from "../../src/selector"
import { measureOne } from "./bench-utils"

const ITER = 1_000_000

let sink: any

describe("hidden class: shape stability", () => {
    test("atom.equal 1M reads, single atom", async () => {
        const a = atom(0, { name: "single" })
        await measureOne("atom.equal × 1M (single)", () => {
            let eq: any
            for (let i = 0; i < ITER; i++) eq = a.equal
            sink = eq
        })
    })

    test("atom.equal 1M reads, mixed option shapes", async () => {
        // 8 distinct option combos. Pre-refactor: 8 hidden classes (one
        // per spread order) → megamorphic IC. Post-refactor: all share
        // the createAtom shape → monomorphic IC.
        const atoms = [
            atom(0, { name: "a" }),
            atom(0, { name: "b", mutable: true }),
            atom(0, { name: "c", maxAge: 1000 }),
            atom(0, { name: "d", maxAge: 1000, staleWhileRevalidate: 500 }),
            atom(0, { name: "e", onSet: () => {} }),
            atom(0, { name: "f", onMount: () => () => {} }),
            atom(0, { name: "g", mutable: true, onSet: () => {} }),
            atom(0, {
                name: "h",
                mutable: true,
                maxAge: 1000,
                staleWhileRevalidate: 500,
                staleIfError: 250,
            }),
        ]
        await measureOne("atom.equal × 1M (8 shapes)", () => {
            let eq: any
            for (let i = 0; i < ITER; i++) {
                eq = atoms[i & 7].equal
            }
            sink = eq
        })
    })

    test("selector.equal 1M reads, mixed option shapes", async () => {
        const selectors = [
            selector(() => 1, { name: "a" }),
            selector(() => 1, { name: "b", equal: (a, b) => a === b }),
            selector(() => 1, { equal: (a, b) => a === b }),
            selector(() => 1, { name: "d" }),
        ]
        await measureOne("selector.equal × 1M (4 shapes)", () => {
            let eq: any
            for (let i = 0; i < ITER; i++) {
                eq = selectors[i & 3].equal
            }
            sink = eq
        })
    })

    test("atom property fan-out 250k × 4 reads", async () => {
        // Read four different fields per iteration. With one shape every
        // read is a monomorphic IC hit; pre-refactor each shape variant
        // paid a separate lookup.
        const atoms = [
            atom(0, { name: "a" }),
            atom(0, { name: "b", mutable: true }),
            atom(0, { name: "c", maxAge: 1000 }),
            atom(0, { name: "d", maxAge: 1000, staleWhileRevalidate: 500 }),
            atom(0, { name: "e", onSet: () => {} }),
            atom(0, { name: "f", onMount: () => () => {} }),
            atom(0, { name: "g", mutable: true, onSet: () => {} }),
            atom(0, {
                name: "h",
                mutable: true,
                maxAge: 1000,
                staleWhileRevalidate: 500,
                staleIfError: 250,
            }),
        ]
        await measureOne("atom hot reads × 1M ops", () => {
            let acc: any
            for (let i = 0; i < 250_000; i++) {
                const a = atoms[i & 7]
                acc = a.equal
                acc = a.maxAge
                acc = a.onMount
                acc = a.mutable
            }
            sink = acc
        })
    })
})
