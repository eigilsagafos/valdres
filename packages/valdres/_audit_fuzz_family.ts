/**
 * Propagation soundness fuzzer — atom-family + index() + scope churn.
 *
 *   bun packages/valdres/_audit_fuzz_family.ts [maxSeed]
 *
 * Targets the family-index paths the core fuzzer doesn't: deleteFamilyAtom,
 * index() over a family whose membership churns inside one txn (seed regression
 * #3 — must not crash on Object.hasOwn(undefined), must not return stale), and
 * the cross-scope family-index re-linking (recursivelyUpdateIndexes).
 *
 * Oracle tracks logical membership per store-context and compares membership /
 * index results as SETS of keys (get(family) order is performance.now()-tie
 * non-deterministic, so order is not asserted) and selector reductions as
 * order-independent sums.
 */

import { atomFamily } from "./src/atomFamily"
import { selector } from "./src/selector"
import { store } from "./src/store"
import { index } from "./src/indexConstructor"

const mulberry32 = (seed: number) => () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

type Violation = { kind: string; detail: string }

type Op =
    | { t: "set"; ctx: "r" | "c"; k: number; val: number }
    | { t: "del"; ctx: "r" | "c"; k: number }
    | { t: "txn"; ctx: "r" | "c"; sets: { k: number; val: number }[]; dels: number[] }
    | { t: "sub"; ctx: "r" | "c"; which: { kind: "sum" | "count" } | { kind: "index"; term: number } }
    | { t: "unsub"; ctx: "r" | "c"; which: { kind: "sum" | "count" } | { kind: "index"; term: number } }

const NTERMS = 3

const run = (seed: number, K: number, useScope: boolean, steps: number): { ok: true } | { ok: false; step: number; violations: Violation[] } => {
    const rnd = mulberry32(seed * 2654435761)
    const fam = atomFamily<number, [string]>(() => 0, { name: "fam" })
    const keyOf = (k: number) => `k${k}`

    // selectors under test
    const sumSel = selector(
        get => (get(fam) as any[]).reduce((a, m) => (a + (get(m) | 0)) | 0, 0),
        { name: "sum" },
    )
    const countSel = selector(get => (get(fam) as any[]).length, { name: "count" })
    const idx = index<number, number, [string]>(fam, (v, term) => ((v | 0) % NTERMS + NTERMS) % NTERMS === term, { name: "byMod" })
    const idxSel = Array.from({ length: NTERMS }, (_, term) => idx(term))

    const root = store(undefined, { enumerable: true })
    const child: any = useScope ? root.scope("child") : null

    // logical membership
    const rootM = new Map<number, number>()
    const scopeCreated = new Map<number, number>()
    const scopeDeleted = new Set<number>()

    const scopeKeys = (): Set<number> => {
        const out = new Set<number>()
        for (const k of rootM.keys()) if (!scopeDeleted.has(k)) out.add(k)
        for (const k of scopeCreated.keys()) if (!scopeDeleted.has(k)) out.add(k)
        return out
    }
    const scopeVal = (k: number) => (scopeCreated.has(k) ? scopeCreated.get(k)! : rootM.get(k)!)

    const memberKeysFromValue = (arr: any[]): Set<string> => new Set(arr.map(a => a.familyArgs[0]))

    const subs = new Map<string, () => void>()
    const subKey = (ctx: string, w: any) => `${ctx}:${w.kind}${w.kind === "index" ? w.term : ""}`

    const verify = (): Violation[] => {
        const out: Violation[] = []
        const ctxs: { label: string; data: any; keys: () => Set<number>; val: (k: number) => number }[] = [
            { label: "root", data: root.data, keys: () => new Set(rootM.keys()), val: (k: number) => rootM.get(k)! },
        ]
        if (useScope) ctxs.push({ label: "scope", data: child.data, keys: scopeKeys, val: scopeVal })

        for (const c of ctxs) {
            const keys = c.keys()
            // get(family) membership (as key set)
            if (c.data.values.has(fam)) {
                const got = memberKeysFromValue(c.data.values.get(fam))
                const expected = new Set([...keys].map(keyOf))
                if (got.size !== expected.size || [...expected].some(k => !got.has(k))) {
                    out.push({ kind: "family-membership", detail: `${c.label}: got={${[...got].sort()}} expected={${[...expected].sort()}}` })
                }
            }
            // sum selector
            if (c.data.values.has(sumSel)) {
                const stored = c.data.values.get(sumSel)
                const exp = [...keys].reduce((a, k) => (a + (c.val(k) | 0)) | 0, 0)
                if (stored !== exp) out.push({ kind: "sum-stale", detail: `${c.label}: sum stored=${stored} expected=${exp}` })
            }
            // count selector
            if (c.data.values.has(countSel)) {
                const stored = c.data.values.get(countSel)
                if (stored !== keys.size) out.push({ kind: "count-stale", detail: `${c.label}: count stored=${stored} expected=${keys.size}` })
            }
            // index selectors
            for (let term = 0; term < NTERMS; term++) {
                const sel = idxSel[term]
                if (c.data.values.has(sel)) {
                    const got = memberKeysFromValue(c.data.values.get(sel))
                    const expected = new Set([...keys].filter(k => (((c.val(k) | 0) % NTERMS) + NTERMS) % NTERMS === term).map(keyOf))
                    if (got.size !== expected.size || [...expected].some(k => !got.has(k))) {
                        out.push({ kind: "index-stale", detail: `${c.label}: idx(${term}) got={${[...got].sort()}} expected={${[...expected].sort()}}` })
                    }
                }
            }
        }
        return out
    }

    const applyLogical = (ctx: "r" | "c", op: "set" | "del", k: number, val?: number) => {
        if (ctx === "r") {
            if (op === "set") rootM.set(k, val!)
            else rootM.delete(k)
        } else {
            if (op === "set") { scopeCreated.set(k, val!); scopeDeleted.delete(k) }
            else { scopeDeleted.add(k); scopeCreated.delete(k) }
        }
    }

    const stOf = (ctx: "r" | "c") => (ctx === "r" ? root : child)

    const log: Op[] = []
    const retired = new Set<number>()
    for (let step = 0; step < steps; step++) {
        const op = genOp(rnd, K, useScope, retired)
        log.push(op)
        try {
            switch (op.t) {
                case "set":
                    applyLogical(op.ctx, "set", op.k, op.val)
                    stOf(op.ctx).set(fam(keyOf(op.k)), op.val)
                    break
                case "del":
                    // only delete if the member exists in that ctx (else engine may
                    // operate on a non-member; mirror by skipping logical change if absent)
                    applyLogical(op.ctx, "del", op.k)
                    stOf(op.ctx).del(fam(keyOf(op.k)))
                    break
                case "txn": {
                    for (const s of op.sets) applyLogical(op.ctx, "set", s.k, s.val)
                    for (const d of op.dels) applyLogical(op.ctx, "del", d)
                    const st = stOf(op.ctx)
                    if (op.ctx === "r") {
                        st.txn((t: any) => {
                            for (const s of op.sets) t.set(fam(keyOf(s.k)), s.val)
                            for (const d of op.dels) t.del(fam(keyOf(d)))
                        })
                    } else {
                        root.txn((t: any) => {
                            t.scope("child", (ct: any) => {
                                for (const s of op.sets) ct.set(fam(keyOf(s.k)), s.val)
                                for (const d of op.dels) ct.del(fam(keyOf(d)))
                            })
                        })
                    }
                    break
                }
                case "sub": {
                    const key = subKey(op.ctx, op.which)
                    if (!subs.has(key)) {
                        const st = stOf(op.ctx)
                        const sel = op.which.kind === "sum" ? sumSel : op.which.kind === "count" ? countSel : idxSel[op.which.term]
                        subs.set(key, st.sub(sel, () => {}))
                    }
                    break
                }
                case "unsub": {
                    const key = subKey(op.ctx, op.which)
                    const u = subs.get(key)
                    if (u) { u(); subs.delete(key) }
                    break
                }
            }
        } catch (e) {
            return { ok: false, step, violations: [{ kind: "throw", detail: `op ${op.t} threw: ${(e as Error)?.stack ?? e}` }] }
        }
        const v = verify()
        if (v.length) return { ok: false, step, violations: v, log } as any
    }
    for (const u of subs.values()) u()
    return { ok: true }
}

// Values are 1..9 — never the family default (0). Setting a member to a value
// equal to its current value (default 0 when absent) hits setAtom's equality
// short-circuit and creates no member; using non-default values keeps `set`
// an unambiguous create/update so the independent membership oracle is exact.
const VAL = (rnd: () => number) => 1 + Math.floor(rnd() * 9)

const genOp = (rnd: () => number, K: number, useScope: boolean, retired: Set<number>): Op => {
    const ctx: "r" | "c" = useScope && rnd() < 0.5 ? "c" : "r"
    // Retire any deleted key: deleteFamilyAtom calls family.release(...), so a
    // re-created key mints a FRESH atom identity. Tombstones are identity-keyed,
    // so delete-then-recreate (especially across scopes) has ambiguous intended
    // semantics (key vs identity) that the differential oracle can't pin down.
    // Never re-create a deleted key, keeping the membership oracle exact while
    // still exercising deletes + one-txn membership churn (seed regression #3).
    // Disjoint key spaces per context: root mutates [0, KR), scope mutates
    // [KR, K). No key is ever set/deleted by two contexts, so deleteFamilyAtom's
    // GLOBAL family.release(...) can never strand the other context on a fresh
    // identity. The scope still INHERITS root's [0, KR) members (read-through),
    // so scope membership / sum / index over the union is still tested — and so
    // is the fixed bug (scope creates its index in a txn, root adds members
    // later, scope must observe them).
    const KR = Math.max(1, Math.floor(K / 2))
    const lo = ctx === "r" ? 0 : KR
    const hi = ctx === "r" ? KR : K
    const settable = (): number => {
        for (let tries = 0; tries < 12; tries++) {
            const k = lo + Math.floor(rnd() * (hi - lo))
            if (!retired.has(k)) return k
        }
        return -1
    }
    const delKey = (): number => lo + Math.floor(rnd() * (hi - lo))
    const roll = rnd()
    if (roll < 0.3) {
        const k = settable()
        if (k < 0) return { t: "sub", ctx, which: { kind: "count" } }
        return { t: "set", ctx, k, val: VAL(rnd) }
    } else if (roll < 0.45) {
        const k = delKey()
        retired.add(k)
        return { t: "del", ctx, k }
    } else if (roll < 0.8) {
        const ns = 1 + Math.floor(rnd() * 3)
        const nd = Math.floor(rnd() * 3)
        const sets = Array.from({ length: ns }, () => ({ k: settable(), val: VAL(rnd) })).filter(s => s.k >= 0)
        const setKeys = new Set(sets.map(s => s.k))
        // Disjoint set/del keys within one txn: set+del of the SAME key in one
        // commit has an order-dependent outcome that isn't part of this audit.
        const dels = Array.from({ length: nd }, () => delKey()).filter(d => !setKeys.has(d))
        for (const d of dels) retired.add(d)
        return { t: "txn", ctx, sets, dels }
    } else {
        const r2 = rnd()
        const which =
            r2 < 0.33 ? { kind: "sum" as const } : r2 < 0.66 ? { kind: "count" as const } : { kind: "index" as const, term: Math.floor(rnd() * NTERMS) }
        return { t: rnd() < 0.6 ? "sub" : "unsub", ctx, which }
    }
}

const maxSeed = Number(process.argv[2] ?? 5000)
let failures = 0
const t0 = Date.now()
for (let seed = 1; seed <= maxSeed; seed++) {
    const rnd = mulberry32(seed)
    const K = 3 + Math.floor(rnd() * 6)
    const useScope = rnd() < 0.6
    const steps = 30 + Math.floor(rnd() * 40)
    let r
    try {
        r = run(seed, K, useScope, steps)
    } catch (e) {
        r = { ok: false as const, step: -1, violations: [{ kind: "harness-throw", detail: String(e) }] }
    }
    if (!r.ok) {
        failures++
        console.log(`\n❌ SEED ${seed} FAILED at step ${r.step} (K=${K}, scope=${useScope})`)
        for (const v of r.violations.slice(0, 8)) console.log(`   [${v.kind}] ${v.detail}`)
        if ((r as any).log) console.log(`   OPS: ${JSON.stringify((r as any).log.slice(0, r.step + 1))}`)
        if (failures >= 3) { console.log("\nstopping after 3 failures"); break }
    }
}
console.log(`\nDone: ${maxSeed} seeds, ${failures} failures, ${Date.now() - t0}ms`)
