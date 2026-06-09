import { describe, expect, test } from "bun:test"
import { atomFamily } from "../atomFamily"
import { selector } from "../selector"
import { store } from "../store"
import { index } from "../indexConstructor"

// Differential soundness fuzzer for atom-family × scope × transaction
// propagation — the deliverable backbone of the propagation audit, distilled to
// a bounded CI guard. Random membership churn (single set/del, batched txn,
// scope-only txn, and nested cross-scope txn) drives the engine over a store
// chain of 1..4 levels (root → s1 → s2 → s3); after every committed op an
// independent membership oracle checks that get(family), a sum/count selector
// over the family, and index() per-term results match a from-scratch recompute
// at EVERY level of the chain.
//
// Constraints that keep the oracle exact without weakening coverage of the
// audited paths (see audit notes):
//  - member values are 1..9 (never the family default 0) so `set` is always an
//    unambiguous create/update (no equality short-circuit);
//  - a deleted key is retired (never re-created) because deleteFamilyAtom calls
//    family.release(...), minting a fresh identity whose key↔identity mapping is
//    ambiguous across stores;
//  - each level owns a DISJOINT key range, so deleteFamilyAtom's GLOBAL release
//    can never strand another level on a stale identity. The chain is linear, so
//    a key owned by level j is visible at level j and all DEEPER levels
//    (descendants inherit) and at no ancestor — making membership at level i
//    exactly "every existing key owned by levels 0..i", with a single owner per
//    key so its value is unambiguous. Inheritance across the full chain (the
//    grandchild path that broke before consolidation) is therefore exercised
//    directly.

const NTERMS = 3
const PER_LEVEL = 3 // keys owned by each level
const mulberry32 = (seed: number) => () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

type Which = { kind: "sum" | "count" } | { kind: "index"; term: number }

const runSeed = (seed: number): string | null => {
    const rnd = mulberry32(seed * 2654435761)
    const L = 1 + Math.floor(rnd() * 4) // 1..4 levels including root
    const K = L * PER_LEVEL
    const ownerOf = (k: number) => Math.floor(k / PER_LEVEL)
    const steps = 30 + Math.floor(rnd() * 30)

    const fam = atomFamily<number, [string]>(() => 0, { name: `fam${seed}` })
    const key = (k: number) => `k${k}`
    const sumSel = selector(get => (get(fam) as any[]).reduce((a, m) => (a + (get(m) | 0)) | 0, 0), { name: "sum" })
    const countSel = selector(get => (get(fam) as any[]).length, { name: "count" })
    const idx = index<number, number, [string]>(fam, (v, term) => (((v | 0) % NTERMS) + NTERMS) % NTERMS === term, { name: "byMod" })
    const idxSel = Array.from({ length: NTERMS }, (_, term) => idx(term))

    // Build the linear store chain. stores[0] = root; stores[i] = scope "s{i}".
    const root = store(undefined, { enumerable: true })
    const stores: any[] = [root]
    for (let i = 1; i < L; i++) stores.push(stores[i - 1].scope(`s${i}`))

    // Oracle: single owner per key, so exists+value fully determine membership.
    const exists = new Array(K).fill(false)
    const value = new Array(K).fill(0)
    const retired = new Set<number>()

    // membership at level i = every existing key owned by a level 0..i
    const keysAt = (i: number): number[] => {
        const out: number[] = []
        for (let k = 0; k < K; k++) if (ownerOf(k) <= i && exists[k]) out.push(k)
        return out
    }

    const memberKeys = (arr: any[]) => new Set(arr.map(a => a.familyArgs[0]))
    const setEq = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every(x => b.has(x))

    const subs = new Map<string, () => void>()
    const subKey = (lvl: number, w: Which) => `${lvl}:${w.kind}${w.kind === "index" ? w.term : ""}`

    const verify = (): string | null => {
        for (let i = 0; i < L; i++) {
            const data = stores[i].data
            const ks = keysAt(i)
            if (data.values.has(fam)) {
                const expected = new Set(ks.map(key))
                if (!setEq(memberKeys(data.values.get(fam)), expected))
                    return `L${i} membership: got {${[...memberKeys(data.values.get(fam))].sort()}} expected {${[...expected].sort()}}`
            }
            if (data.values.has(sumSel)) {
                const exp = ks.reduce((a, k) => (a + (value[k] | 0)) | 0, 0)
                if (data.values.get(sumSel) !== exp) return `L${i} sum: ${data.values.get(sumSel)} != ${exp}`
            }
            if (data.values.has(countSel) && data.values.get(countSel) !== ks.length)
                return `L${i} count: ${data.values.get(countSel)} != ${ks.length}`
            for (let term = 0; term < NTERMS; term++) {
                if (!data.values.has(idxSel[term])) continue
                const got = memberKeys(data.values.get(idxSel[term]))
                const exp = new Set(ks.filter(k => (((value[k] | 0) % NTERMS) + NTERMS) % NTERMS === term).map(key))
                if (!setEq(got, exp)) return `L${i} idx(${term}): got {${[...got].sort()}} expected {${[...exp].sort()}}`
            }
        }
        return null
    }

    const settableAt = (lvl: number): number => {
        const lo = lvl * PER_LEVEL
        for (let t = 0; t < 10; t++) {
            const k = lo + Math.floor(rnd() * PER_LEVEL)
            if (!retired.has(k)) return k
        }
        return -1
    }
    const delAt = (lvl: number) => lvl * PER_LEVEL + Math.floor(rnd() * PER_LEVEL)
    const applySet = (k: number, v: number) => { exists[k] = true; value[k] = v }
    const applyDel = (k: number) => { exists[k] = false; retired.add(k) }

    // Build one level's set/del ops (disjoint keys), applied to BOTH oracle and
    // (via the supplied `t` interface) the engine.
    const planLevelOps = (lvl: number) => {
        const ns = Math.floor(rnd() * 3)
        const nd = Math.floor(rnd() * 2)
        const sets = Array.from({ length: ns }, () => ({ k: settableAt(lvl), val: 1 + Math.floor(rnd() * 9) })).filter(s => s.k >= 0)
        const setKeys = new Set(sets.map(s => s.k))
        const dels = Array.from({ length: nd }, () => delAt(lvl)).filter(d => !setKeys.has(d))
        return { sets, dels }
    }

    for (let step = 0; step < steps; step++) {
        const lvl = Math.floor(rnd() * L)
        const roll = rnd()
        if (roll < 0.28) {
            const k = settableAt(lvl)
            if (k >= 0) { const v = 1 + Math.floor(rnd() * 9); applySet(k, v); stores[lvl].set(fam(key(k)), v) }
        } else if (roll < 0.42) {
            const k = delAt(lvl); applyDel(k); stores[lvl].del(fam(key(k)))
        } else if (roll < 0.64) {
            // scope-only (single-store) txn at this level
            const { sets, dels } = planLevelOps(lvl)
            for (const s of sets) applySet(s.k, s.val)
            for (const d of dels) applyDel(d)
            stores[lvl].txn((t: any) => {
                for (const s of sets) t.set(fam(key(s.k)), s.val)
                for (const d of dels) t.del(fam(key(d)))
            })
        } else if (roll < 0.84) {
            // nested cross-scope txn from root down to a random depth
            const maxLevel = Math.floor(rnd() * L)
            const perLevel = Array.from({ length: maxLevel + 1 }, (_, i) => planLevelOps(i))
            for (let i = 0; i <= maxLevel; i++) {
                for (const s of perLevel[i].sets) applySet(s.k, s.val)
                for (const d of perLevel[i].dels) applyDel(d)
            }
            const build = (t: any, level: number) => {
                for (const s of perLevel[level].sets) t.set(fam(key(s.k)), s.val)
                for (const d of perLevel[level].dels) t.del(fam(key(d)))
                if (level < maxLevel) t.scope(`s${level + 1}`, (st: any) => build(st, level + 1))
            }
            root.txn((t: any) => build(t, 0))
        } else {
            const r2 = rnd()
            const which: Which = r2 < 0.34 ? { kind: "sum" } : r2 < 0.67 ? { kind: "count" } : { kind: "index", term: Math.floor(rnd() * NTERMS) }
            const sk = subKey(lvl, which)
            if (rnd() < 0.6) {
                if (!subs.has(sk)) {
                    const sel = which.kind === "sum" ? sumSel : which.kind === "count" ? countSel : idxSel[which.term]
                    subs.set(sk, stores[lvl].sub(sel, () => {}))
                }
            } else { const u = subs.get(sk); if (u) { u(); subs.delete(sk) } }
        }
        const err = verify()
        if (err) return `seed ${seed} (L=${L}) step ${step}: ${err}`
    }
    for (const u of subs.values()) u()
    return null
}

describe("scope × family × txn differential fuzz (nested chains)", () => {
    test("incremental store matches the membership/selector oracle at every level", () => {
        for (let seed = 1; seed <= 500; seed++) {
            const failure = runSeed(seed)
            expect(failure).toBeNull()
        }
    }, 30_000)
})
