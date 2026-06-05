import { describe, expect, test } from "bun:test"
import { atom } from "../atom"
import { selector } from "../selector"
import { store } from "../store"

const mulberry32 = (seed: number) => () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// Regression for the "stale position / stale connector line" bug.
//
// A cross-scope commit (and the single-store update+delete commit) runs one
// propagation pass per store. The original cross-scope work (beta.5 #168) added
// a per-commit dedup guard so a selector reachable by more than one pass
// evaluated once — but it (a) keyed by selector object, skipping a scope's copy
// of a selector also live in the root, and (b) locked in a value an early pass
// computed from an intermediate selector a later pass corrected. Either way the
// selector (and its whole subtree) was left stale — e.g. drag a node and drop
// it back outside any dropzone (a pure revert) and the subtree settles one row
// too low because a layout selector kept a value derived from a now-stale input.
//
// The fix removed the cross-pass dedup guard entirely: every value is written
// first, then each store re-derives its OWN selectors against that final state
// (a selector reachable by two passes is recomputed in each — the equality
// check prunes the redundant result), and subscribers are notified once at the
// end. So each store's copy of a selector ends on its correct final value.

describe("cross-scope stale intermediate selector", () => {
    test("scope selector spanning a root atom + an intermediate scope selector stays fresh", () => {
        const R = atom(1, { name: "csx-R" }) // root atom
        const A = atom(10, { name: "csx-A" }) // shadowed in scope
        const N = selector(get => get(A) * 1000, { name: "csx-N" }) // intermediate, scope-internal
        const M = selector(get => get(R) + get(N), { name: "csx-M" }) // spans R (root) + N (scope)

        const root = store()
        const S = root.scope("S")
        S.set(A, 10) // establish the scope shadow
        S.sub(N, () => {})
        S.sub(M, () => {})
        expect(S.get(M)).toBe(10001)

        // Revert-style cross-scope commit: change the root atom AND the scope
        // atom in one transaction. M is reached in the root pass (via R) before
        // N is recomputed in the scope pass; it must not stay stale.
        root.txn(t => {
            t.set(R, 2)
            t.scope("S", st => st.set(A, 20))
        })

        expect(S.get(N)).toBe(20000)
        expect(S.get(M)).toBe(20002) // was 10002 (R updated, N stale) before the fix
    })

    test("deeper spanning chain stays fresh (R + N1 -> N2 -> M)", () => {
        const R = atom(1, { name: "csx2-R" })
        const A = atom(10, { name: "csx2-A" })
        const N1 = selector(get => get(A) + 1, { name: "csx2-N1" })
        const N2 = selector(get => get(N1) * 100, { name: "csx2-N2" })
        const M = selector(get => get(R) + get(N2), { name: "csx2-M" })

        const root = store()
        const S = root.scope("S")
        S.set(A, 10)
        S.sub(N1, () => {})
        S.sub(N2, () => {})
        S.sub(M, () => {})
        expect(S.get(M)).toBe(1 + (10 + 1) * 100)

        root.txn(t => {
            t.set(R, 2)
            t.scope("S", st => st.set(A, 20))
        })

        expect(S.get(M)).toBe(2 + (20 + 1) * 100)
    })

    test("a selector live in BOTH root and scope is fresh in each after a cross-scope txn", () => {
        // The old per-commit dedup guard was keyed by selector object: the same
        // selector subscribed in the root AND a scope was evaluated in the root
        // pass, marked done, and the scope's (differently valued) copy was
        // skipped — left stale. With no guard, each store re-derives its own
        // copy against the final state, so both land on their correct values.
        const X = atom(1, { name: "ps-X" }) // root atom, read through in scope
        const Y = atom(2, { name: "ps-Y" }) // shadowed in scope
        const s0 = selector(get => get(X) + get(Y), { name: "ps-s0" })
        const s1 = selector(get => get(s0) + get(Y), { name: "ps-s1" })

        const root = store()
        const S = root.scope("S")
        S.set(Y, 20)
        // live in BOTH stores
        root.sub(s0, () => {})
        root.sub(s1, () => {})
        S.sub(s0, () => {})
        S.sub(s1, () => {})
        expect(root.get(s0)).toBe(3)
        expect(S.get(s0)).toBe(21)

        root.txn(t => {
            t.set(X, 5)
            t.scope("S", st => st.set(Y, 30))
        })

        // root: X=5, Y=2  -> s0=7,  s1=9
        expect(root.get(s0)).toBe(7)
        expect(root.get(s1)).toBe(9)
        // scope: X=5 (read-through), Y=30 -> s0=35, s1=65 (was stale 21/41)
        expect(S.get(s0)).toBe(35)
        expect(S.get(s1)).toBe(65)
    })

    test("subscriber is notified once with the final value (serializable)", () => {
        const R = atom(1, { name: "csx3-R" })
        const A = atom(10, { name: "csx3-A" })
        const N = selector(get => get(A) * 1000, { name: "csx3-N" })
        const M = selector(get => get(R) + get(N), { name: "csx3-M" })
        const root = store()
        const S = root.scope("S")
        S.set(A, 10)
        S.sub(N, () => {})
        const observed: number[] = []
        S.sub(M, () => observed.push(S.get(M)))
        expect(S.get(M)).toBe(10001)

        root.txn(t => {
            t.set(R, 2)
            t.scope("S", st => st.set(A, 20))
        })

        // Notification is deferred to commit end, so the subscriber fires
        // exactly once, with the fully-applied value — never the intermediate.
        expect(observed).toEqual([20002])
        expect(S.get(M)).toBe(20002)
    })

    // Randomized DAGs with dynamic deps, scope shadows, and cross-scope txns,
    // selectors subscribed in both stores. Each seed's final state is checked
    // against an independent oracle (fresh stores, final atom values applied via
    // individual sets — never the guarded cross-scope path — then read lazily).
    // This is what surfaced the cross-store guard bug; it now holds.
    test("fuzz: cross-scope selectors match an independent oracle", () => {
        for (let seed = 1; seed <= 300; seed++) {
            const rnd = mulberry32(seed)
            const nAtoms = 3 + Math.floor(rnd() * 3)
            const nSel = 6 + Math.floor(rnd() * 8)
            const defs = Array.from({ length: nSel }, (_, i) => {
                const pick = (n: number, max: number) =>
                    Array.from({ length: n }, () => Math.floor(rnd() * max))
                return {
                    deps: pick(1 + Math.floor(rnd() * 2), nAtoms),
                    selDeps: i > 0 ? pick(Math.floor(rnd() * 2), i) : [],
                    altSelDeps: i > 0 ? pick(Math.floor(rnd() * 2), i) : [],
                    ctrl:
                        i > 0 && rnd() < 0.6
                            ? { sel: Math.floor(rnd() * i) }
                            : { atom: Math.floor(rnd() * nAtoms) },
                    mode: Math.floor(rnd() * 3),
                }
            })
            const build = () => {
                const atoms = Array.from({ length: nAtoms }, (_, i) =>
                    atom(i, { name: `fa${i}` }),
                )
                const sels: any[] = []
                defs.forEach((def: any, idx) => {
                    sels.push(
                        selector(
                            get => {
                                const ctrl =
                                    "atom" in def.ctrl
                                        ? get(atoms[def.ctrl.atom])
                                        : get(sels[def.ctrl.sel])
                                let acc = def.mode + (ctrl % 3)
                                if (ctrl % 2 === 0) {
                                    for (const di of def.deps) acc += get(atoms[di])
                                    for (const si of def.selDeps) acc += get(sels[si])
                                } else {
                                    for (const si of def.altSelDeps)
                                        acc += get(sels[si]) * 2
                                }
                                return acc
                            },
                            { name: `fs${idx}` },
                        ),
                    )
                })
                return { atoms, sels }
            }

            const I = build()
            const root = store()
            const S = root.scope("S")
            const shadowed = Array.from({ length: nAtoms }, () => rnd() < 0.5)
            const rootVal = Array.from({ length: nAtoms }, (_, i) => i)
            const scopeVal: (number | undefined)[] = new Array(nAtoms).fill(undefined)
            for (let ai = 0; ai < nAtoms; ai++) {
                if (shadowed[ai]) {
                    S.set(I.atoms[ai], 100 + ai)
                    scopeVal[ai] = 100 + ai
                }
            }
            for (let si = 0; si < nSel; si++) {
                root.sub(I.sels[si], () => {})
                S.sub(I.sels[si], () => {})
            }

            for (let step = 0; step < 12; step++) {
                const rc: [number, number][] = []
                const sc: [number, number][] = []
                const m = 1 + Math.floor(rnd() * 3)
                for (let j = 0; j < m; j++) {
                    const ai = Math.floor(rnd() * nAtoms)
                    const v = Math.floor(rnd() * 30)
                    if (rnd() < 0.5) rc.push([ai, v])
                    else sc.push([ai, v])
                }
                root.txn(t => {
                    for (const [ai, v] of rc) t.set(I.atoms[ai], v)
                    if (sc.length)
                        t.scope("S", st => {
                            for (const [ai, v] of sc) st.set(I.atoms[ai], v)
                        })
                })
                for (const [ai, v] of rc) rootVal[ai] = v
                for (const [ai, v] of sc) scopeVal[ai] = v
            }

            // independent oracle
            const O = build()
            const oRoot = store()
            const oS = oRoot.scope("S")
            for (let ai = 0; ai < nAtoms; ai++) {
                oRoot.set(O.atoms[ai], rootVal[ai])
                if (scopeVal[ai] !== undefined) oS.set(O.atoms[ai], scopeVal[ai]!)
            }
            for (let si = 0; si < nSel; si++) {
                expect(root.get(I.sels[si])).toBe(oRoot.get(O.sels[si]))
                expect(S.get(I.sels[si])).toBe(oS.get(O.sels[si]))
            }
        }
    })
})
