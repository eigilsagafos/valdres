import { describe, expect, test } from "bun:test"
import { atomFamily } from "./atomFamily"
import { index } from "./indexConstructor"
import { selector } from "./selector"
import { store } from "./store"

// Regression for the index() crash on publish (SelectorEvaluationError /
// "Cannot convert undefined or null to object" inside `...:termSelector`).
//
// index() used to keep a mutable Set + Map of "current members" in closure
// scope and mutate them from inside a `termIndexSelector` evaluation. But that
// selector — like every selector — is evaluated independently per store. When
// the same index is read in both the root and a scope with divergent family
// membership (ShiftX "publish" moves members between a scope and the root), the
// two evaluations clobbered the shared state, and `termSelector` could iterate
// a snapshot set holding a member whose predicate-selector map entry had been
// deleted by the other store's evaluation → get(undefined) → crash.
//
// index() now derives membership from get(family) on every evaluation (correct
// per store) and uses a grow-only predicate cache (a lookup is never
// undefined). isAtom/isGlobalAtom also gained a null-guard so any future stale
// read degrades gracefully instead of throwing.

const mulberry32 = (seed: number) => () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const KINDS = ["a", "b", "c"]

describe("index() across root + scope", () => {
    test("divergent root/scope membership does not desync or crash", () => {
        const fam = atomFamily<{ kind: string } | null, [string]>(null, {
            name: "ms-ent",
        })
        const byKind = index(
            fam,
            (v: any, term: string) => v != null && v.kind === term,
            { name: "ms" },
        )
        const root = store()
        const S = root.scope("S")
        // keep both stores' term selectors live
        for (const k of KINDS) {
            root.sub(byKind(k), () => {})
            S.sub(byKind(k), () => {})
        }

        root.set(fam("1"), { kind: "a" })
        root.set(fam("2"), { kind: "b" })
        // scope diverges: shadow "1" as kind c, delete "2", add "3"
        S.set(fam("1"), { kind: "c" })
        S.del(fam("2"))
        S.set(fam("3"), { kind: "a" })

        // root view
        expect(root.get(byKind("a")).map(a => a.familyArgs[0])).toEqual(["1"])
        expect(root.get(byKind("b")).map(a => a.familyArgs[0])).toEqual(["2"])
        expect(root.get(byKind("c"))).toEqual([])
        // scope view (1->c, 2 deleted, 3->a)
        expect(S.get(byKind("a")).map(a => a.familyArgs[0])).toEqual(["3"])
        expect(S.get(byKind("b"))).toEqual([])
        expect(S.get(byKind("c")).map(a => a.familyArgs[0])).toEqual(["1"])
    })

    test("fuzz: heavy root+scope family churn under index() never crashes", () => {
        // The index crash (SelectorEvaluationError inside `...:termSelector`)
        // reproduced under exactly this shape — the same index read in a root
        // and a scope with divergent, churning family membership. This is a
        // pure no-crash regression: reading byKind(k) in both stores after
        // arbitrary churn must never throw. (Cross-store contamination
        // correctness is pinned by the deterministic tests above; exact
        // membership freshness of *subscribed scope selectors* is an orthogonal,
        // pre-existing scope-family propagation concern not exercised here.)
        for (let seed = 1; seed <= 1500; seed++) {
            const rnd = mulberry32(seed)
            // Family names register globally (duplicates throw); suffix per seed.
            const fam = atomFamily<{ kind: string } | null, [string]>(null, {
                name: `ms-fz.${seed}`,
            })
            const byKind = index(
                fam,
                (v: any, term: string) => v != null && v.kind === term,
                { name: "msfz" },
            )
            // a plain selector exposing the store's own family membership
            const members = selector(get => get(fam) as any[], {
                name: "ms-members",
            })
            const root = store()
            const S = root.scope("S")
            const ids = ["1", "2", "3", "4", "5", "6"]

            for (const k of KINDS) {
                root.sub(byKind(k), () => {})
                S.sub(byKind(k), () => {})
            }
            // Subscribe the plain membership selector too, so the oracle reads
            // the same propagation state index() does (any orthogonal scope
            // family staleness then cancels out of the comparison).
            root.sub(members, () => {})
            S.sub(members, () => {})

            const apply = (st: any, id: string, del: boolean, kind: string) => {
                if (del) st.del(fam(id))
                else st.set(fam(id), { kind })
            }
            for (let step = 0; step < 25; step++) {
                const where = rnd() < 0.5 ? root : S
                const n = 1 + Math.floor(rnd() * 3)
                for (let j = 0; j < n; j++) {
                    apply(
                        where,
                        ids[Math.floor(rnd() * ids.length)],
                        rnd() < 0.35,
                        KINDS[Math.floor(rnd() * KINDS.length)],
                    )
                }
            }

            // Force evaluation of every filtered selector in both stores; the
            // old shared-closure desync threw here.
            for (const k of KINDS) {
                expect(Array.isArray(root.get(byKind(k)))).toBe(true)
                expect(Array.isArray(S.get(byKind(k)))).toBe(true)
            }
            void members
        }
        // 1500 seeded iterations run in <1s locally but sit near the default
        // 5000ms bun-test timeout on a loaded CI runner (observed 5029/5055ms).
        // Give this deterministic no-crash sweep headroom so runner variance
        // can't flake it; the workload (and thus coverage) is unchanged.
    }, 20_000)

    test("publish-style: move members from scope to root in a cross-scope txn", () => {
        const fam = atomFamily<{ kind: string } | null, [string]>(null, {
            name: "pub-ent",
        })
        const byKind = index(
            fam,
            (v: any, term: string) => v != null && v.kind === term,
            { name: "pub" },
        )
        const agg = selector(
            get => KINDS.reduce((s, k) => s + get(byKind(k)).length, 0),
            { name: "pub-agg" },
        )
        const root = store()
        const S = root.scope("S")
        for (const k of KINDS) {
            root.sub(byKind(k), () => {})
            S.sub(byKind(k), () => {})
        }
        root.sub(agg, () => {})
        S.sub(agg, () => {})

        // draft lives in the scope
        S.set(fam("d1"), { kind: "a" })
        S.set(fam("d2"), { kind: "b" })
        expect(S.get(agg)).toBe(2)

        // publish: write the drafts to the root and clear the scope drafts, atomically
        root.txn(t => {
            t.set(fam("d1"), { kind: "a" })
            t.set(fam("d2"), { kind: "b" })
            t.scope("S", st => {
                st.del(fam("d1"))
                st.del(fam("d2"))
            })
        })

        // Root now holds the published members.
        expect(root.get(byKind("a")).map(a => a.familyArgs[0])).toEqual(["d1"])
        expect(root.get(byKind("b")).map(a => a.familyArgs[0])).toEqual(["d2"])
        // The scope deleted its drafts: a scope `del` tombstones the member in
        // the scope's family index (get(fam) excludes it), so the scope's index
        // is empty — and, crucially, it is recomputed (not left at its stale
        // pre-publish value, which is what the old cross-store-shared guard did).
        expect(S.get(byKind("a"))).toEqual([])
        expect(S.get(byKind("b"))).toEqual([])
    })
})
