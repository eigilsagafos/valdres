// `test-compat`, not `bun:test`: `src/lib/*Fuzz.test.ts` is an explicit include
// of the Node/V8 rewrite-guard lane (vitest.rewrite-guards.config.ts), where
// `bun:test` does not resolve. Its siblings all import the same shim, so this
// invariant gets checked on both JSC and V8.
import { describe, expect, test } from "../../test/performance/test-compat"
import { atom } from "../atom"
import { atomFamily } from "../atomFamily"
import { store } from "../store"
import type { Store } from "../types/Store"
import type { AtomOptions } from "../types/AtomOptions"
import { IS_PROD } from "./IS_PROD"

// Property test over the dev-mode deep-freeze policy, which is written out
// TWICE on purpose:
//
//   - `setValueInData.ts` keeps its copy inline — the extra call frame
//     measurably regresses the hot primitive-set path.
//   - `normalizeStagedValue.ts` owns the staging-time copy, shared by
//     `Transaction.set` and `Transaction.batchSetFamilyAtoms`.
//
// The duplication is deliberate and must stay. What this file replaces is the
// "keep the two in sync" comment that was the only thing holding them together.
//
// INVARIANT AS ORACLE — there is no third implementation to diff against, and
// none is needed, because the property is PATH INVARIANCE:
//
//   P1. For one (atom, value) pair, every write path produces the same outcome:
//       the same throw-or-commit, the same per-node freeze signature, and the
//       same object identity. A policy that drifts on one path breaks this
//       without anyone having to say what the policy IS.
//   P2. `mutable: true` is honoured everywhere: the committed graph is frozen
//       exactly as much as it already was before the write (usually not at
//       all), and no path ever throws for it.
//   P3. Without `mutable`, a committed object graph is frozen ALL THE WAY DOWN
//       along deepFreeze's own traversal — every path, every nesting depth.
//   P4. Freezing never copies: the committed value is the caller's reference.
//   P5. A staging path that rejects a value commits NOTHING — an unrelated
//       write staged beside it in the same transaction must not land. This is
//       the ordering claim in normalizeStagedValue's contract ("a schema
//       failure throws here, inside the user's transaction callback, so commit
//       never runs"), and it is what makes the staged copy load-bearing rather
//       than merely redundant with the commit-time one.
//
// The value generator is seeded and random, so the shapes are not a list
// someone chose; the fixed catalogue below only pins the shapes whose freeze
// behaviour is interesting enough to name (cycles, getters, symbol keys,
// null prototypes, unfreezable built-ins, already-frozen input).

const mulberry32 = (seed: number) => () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/**
 * Every object/function node reachable from `value`, labelled by structural
 * path, with whether it is frozen.
 *
 * The traversal deliberately mirrors `deepFreeze`'s, because the policy can
 * only be held to the surface it actually walks: own property NAMES only (so
 * symbol-keyed children are invisible to both), arrays by element, no descent
 * into internal slots (a Map's entries are unreachable here exactly as they are
 * there), and — the subtle one — descent ONLY into children that are `typeof
 * "object"`. A function passed as the whole value IS frozen; a function sitting
 * in a property is not, because deepFreeze's recursion guard skips it. Those
 * nodes are recorded as `unvisited` so the two write paths still have to agree
 * about them without P3 demanding they be frozen.
 *
 * Property reads can run user getters, same as deepFreeze.
 */
const freezeSignature = (value: unknown): string[] => {
    const out: string[] = []
    const seen = new WeakSet<object>()
    const walk = (node: unknown, path: string, visited: boolean) => {
        if (node === null) return
        const kind = typeof node
        if (kind !== "object" && kind !== "function") return
        if (seen.has(node)) return
        seen.add(node)
        const state = !visited
            ? "unvisited"
            : Object.isFrozen(node)
              ? "frozen"
              : "live"
        out.push(`${path}=${state}`)
        // deepFreeze's own descent condition, verbatim.
        const descend = (child: unknown, childPath: string) =>
            walk(
                child,
                childPath,
                visited && !!child && typeof child === "object",
            )
        if (Array.isArray(node)) {
            node.forEach((item, index) => descend(item, `${path}[${index}]`))
            return
        }
        for (const name of Object.getOwnPropertyNames(node)) {
            // A throwing getter is a value the caller owns, not a policy
            // question — record it and move on so both paths see the same node.
            let child: unknown
            try {
                child = (node as any)[name]
            } catch {
                out.push(`${path}.${name}=<threw>`)
                continue
            }
            descend(child, `${path}.${name}`)
        }
    }
    walk(value, "$", true)
    return out.sort()
}

const describeError = (error: unknown): string => {
    const message = error instanceof Error ? error.message : String(error)
    const name = error instanceof Error ? error.constructor.name : "throw"
    // Truncated: the tail names the offending built-in, which is the part that
    // has to match across paths. The remedy sentence is boilerplate.
    return `${name}: ${message.split(". ")[0]}`
}

// ——— value shapes ———

/** A factory, not a value: `deepFreeze` mutates in place, so every write path
 *  must be handed a structurally identical but FRESH graph. Reusing one value
 *  would let the first path's freeze answer for all the others. */
type ValueFactory = { label: string; make: () => unknown }

class Point {
    constructor(
        public x: number,
        public y: number,
    ) {}
}

const CATALOGUE: ValueFactory[] = [
    { label: "number", make: () => 7 },
    { label: "string", make: () => "seven" },
    { label: "boolean", make: () => false },
    { label: "null", make: () => null },
    { label: "undefined", make: () => undefined },
    { label: "bigint", make: () => 7n },
    { label: "flat-object", make: () => ({ a: 1, b: "two" }) },
    { label: "nested-object", make: () => ({ a: { b: { c: 1 } } }) },
    { label: "array", make: () => [1, 2, 3] },
    { label: "array-of-objects", make: () => [{ a: 1 }, { b: 2 }] },
    { label: "sparse-array", make: () => [, { a: 1 }, ,] },
    {
        label: "shared-substructure",
        make: () => {
            const shared = { s: 1 }
            return { l: shared, r: shared }
        },
    },
    {
        label: "cyclic",
        make: () => {
            const node: any = { name: "root" }
            node.self = node
            node.child = { parent: node }
            return node
        },
    },
    { label: "function", make: () => () => 1 },
    { label: "object-with-function", make: () => ({ fn: () => 1 }) },
    { label: "class-instance", make: () => new Point(1, 2) },
    { label: "nested-class-instance", make: () => ({ p: new Point(1, 2) }) },
    {
        label: "null-prototype",
        make: () => Object.assign(Object.create(null), { a: 1 }),
    },
    { label: "error", make: () => new Error("boom") },
    { label: "already-frozen", make: () => Object.freeze({ a: 1 }) },
    {
        label: "partially-frozen",
        make: () => ({ frozen: Object.freeze({ a: 1 }), live: { b: 2 } }),
    },
    {
        label: "sealed-not-frozen",
        make: () => Object.seal({ a: 1, nested: { b: 2 } }),
    },
    {
        label: "stable-getter",
        make: () => {
            const child = { c: 1 }
            return Object.defineProperty({} as any, "viaGetter", {
                get: () => child,
                enumerable: true,
                configurable: true,
            })
        },
    },
    {
        label: "symbol-keyed-child",
        make: () => ({ plain: { a: 1 }, [Symbol("hidden")]: { b: 2 } }),
    },
    {
        label: "non-enumerable-child",
        make: () =>
            Object.defineProperty({ visible: { a: 1 } } as any, "hidden", {
                value: { b: 2 },
                enumerable: false,
                configurable: true,
                writable: true,
            }),
    },
    // Unfreezable built-ins: Object.freeze cannot make their internal slots
    // immutable (or throws outright, for typed arrays), so the policy rejects
    // them. Which ones, and at what depth, must not depend on the write path.
    { label: "map", make: () => new Map([["k", 1]]) },
    { label: "set", make: () => new Set([1]) },
    { label: "date", make: () => new Date(0) },
    { label: "regexp", make: () => /re/g },
    { label: "typed-array", make: () => new Uint8Array([1, 2, 3]) },
    { label: "nested-map", make: () => ({ deep: { m: new Map() } }) },
    { label: "array-holding-set", make: () => [{ s: new Set() }] },
]

/** Random object graph: depth, breadth, leaf kinds and the occasional
 *  unfreezable built-in or back-edge all drawn from the seed. */
const randomFactory = (seed: number): ValueFactory => ({
    label: `random-${seed}`,
    make: () => {
        const rnd = mulberry32(seed)
        const pick = <T>(xs: readonly T[]): T =>
            xs[Math.floor(rnd() * xs.length)]!
        const created: any[] = []
        const build = (depth: number): unknown => {
            const roll = rnd()
            if (depth >= 4 || roll < 0.3) {
                return pick([
                    1,
                    "leaf",
                    true,
                    null,
                    undefined,
                    () => 1,
                    new Map(),
                    new Set(),
                    new Date(0),
                    new Uint8Array(1),
                    Object.freeze({ frozenLeaf: 1 }),
                    new Point(1, 2),
                ])
            }
            // Back-edge into an already-built node: makes cycles and shared
            // substructure without a special case.
            if (created.length > 0 && roll < 0.38) return pick(created)
            const width = 1 + Math.floor(rnd() * 3)
            if (roll < 0.55) {
                const node: any[] = []
                created.push(node)
                for (let i = 0; i < width; i++) node.push(build(depth + 1))
                return node
            }
            const node: any = {}
            created.push(node)
            for (let i = 0; i < width; i++) node[`k${i}`] = build(depth + 1)
            if (rnd() < 0.15) Object.freeze(node)
            return node
        }
        return build(0)
    },
})

// ——— write paths ———

type Attempt = {
    error: string | null
    signature: string[] | null
    /** deepFreeze must never copy. */
    identity: boolean | null
}

type WritePath = {
    label: string
    /** Family-member target instead of a plain atom. */
    family: boolean
    /** Staged inside a transaction body, so P5 applies. */
    staging: boolean
    /** Whether this path can express `value` AT ALL. Two API facts, neither of
     *  them about the freeze policy, make some (value, path) pairs unwritable:
     *
     *    - `set(atom, fn)` is the UPDATER overload, so a function cannot be
     *      written positionally — only via `set(atom, () => fn)`, a batch pair,
     *      or a default.
     *    - a default of `undefined` means "no default", and reading such an
     *      atom yields a pending promise rather than the value.
     *    - a FUNCTION default is a lazy default factory, so the committed value
     *      is its return value, not the function.
     *
     *  Excluding them keeps P1 a statement about the policy instead of about
     *  the overload table. */
    accepts: (value: unknown) => boolean
    run: (
        value: unknown,
        options: AtomOptions<any>,
    ) => Attempt & { siblingLanded: boolean }
}

/** Positional `set(target, value)`: a function argument is read as an updater. */
const NOT_A_FUNCTION = (value: unknown) => typeof value !== "function"
/** A default has two overloads of its own: `undefined` means "no default" (and
 *  reading such an atom yields a pending promise), and a FUNCTION default is a
 *  lazy default factory, so the committed value is what it returns. */
const PLAIN_DEFAULT = (value: unknown) =>
    value !== undefined && typeof value !== "function"
const ANY_VALUE = () => true

/** One store, one target atom and one unrelated sibling atom per attempt: a
 *  fresh target because the default `equal` is structural, so a second write of
 *  an identical clone would bail before reaching the policy at all. */
const stage = (options: AtomOptions<any>, family: boolean) => {
    const root = store()
    const sibling = atom(0)
    const target = family
        ? atomFamily<any, [string]>(() => null, options)("member")
        : atom<any>(null, options)
    return { root, target, sibling }
}

/** `root` is released before returning: the catalogue and the random graphs
 *  together build ~9,000 stores per run, and this package gates on retained
 *  memory (test:memory:{bun,node}), so a fuzz that hoards stores is a fuzz that
 *  eventually fails something unrelated. */
const attempt = (
    root: Store,
    write: () => void,
    read: () => unknown,
    siblingRead: () => number,
    value: unknown,
): Attempt & { siblingLanded: boolean } => {
    let error: string | null = null
    try {
        write()
    } catch (thrown) {
        error = describeError(thrown)
    }
    const siblingLanded = siblingRead() === 99
    // Read everything BEFORE disposing — a disposed store throws on read.
    const committed = error === null ? read() : undefined
    const outcome: Attempt & { siblingLanded: boolean } =
        error !== null
            ? { error, signature: null, identity: null, siblingLanded }
            : {
                  error: null,
                  signature: freezeSignature(committed),
                  identity: committed === value,
                  siblingLanded,
              }
    root.dispose()
    return outcome
}

const PATHS: WritePath[] = [
    {
        label: "direct-set",
        family: false,
        staging: false,
        accepts: NOT_A_FUNCTION,
        run: (value, options) => {
            const { root, target, sibling } = stage(options, false)
            return attempt(
                root,
                () => {
                    root.set(sibling, 99)
                    root.set(target, value)
                },
                () => root.get(target),
                () => root.get(sibling),
                value,
            )
        },
    },
    {
        label: "direct-set-updater",
        family: false,
        staging: false,
        accepts: ANY_VALUE,
        run: (value, options) => {
            const { root, target, sibling } = stage(options, false)
            return attempt(
                root,
                () => {
                    root.set(sibling, 99)
                    root.set(target, () => value)
                },
                () => root.get(target),
                () => root.get(sibling),
                value,
            )
        },
    },
    {
        label: "scope-direct-set",
        family: false,
        staging: false,
        accepts: NOT_A_FUNCTION,
        run: (value, options) => {
            const { root, target, sibling } = stage(options, false)
            const scope = root.scope("s")
            return attempt(
                root,
                () => {
                    scope.set(sibling, 99)
                    scope.set(target, value)
                },
                () => scope.get(target),
                () => scope.get(sibling),
                value,
            )
        },
    },
    {
        label: "txn-set",
        family: false,
        staging: true,
        accepts: NOT_A_FUNCTION,
        run: (value, options) => {
            const { root, target, sibling } = stage(options, false)
            return attempt(
                root,
                () =>
                    root.txn(txn => {
                        txn.set(sibling, 99)
                        txn.set(target, value)
                    }),
                () => root.get(target),
                () => root.get(sibling),
                value,
            )
        },
    },
    {
        label: "txn-set-updater",
        family: false,
        staging: true,
        accepts: ANY_VALUE,
        run: (value, options) => {
            const { root, target, sibling } = stage(options, false)
            return attempt(
                root,
                () =>
                    root.txn(txn => {
                        txn.set(sibling, 99)
                        txn.set(target, () => value)
                    }),
                () => root.get(target),
                () => root.get(sibling),
                value,
            )
        },
    },
    {
        label: "txn-scope-set",
        family: false,
        staging: true,
        accepts: NOT_A_FUNCTION,
        run: (value, options) => {
            const { root, target, sibling } = stage(options, false)
            // Materialize the scope before the transaction: `txn.scope` resolves
            // an already-registered scope by id.
            const scope = root.scope("s")
            return attempt(
                root,
                () =>
                    root.txn(txn =>
                        txn.scope("s", scoped => {
                            scoped.set(sibling, 99)
                            scoped.set(target, value)
                        }),
                    ),
                () => scope.get(target),
                () => scope.get(sibling),
                value,
            )
        },
    },
    {
        label: "family-direct-set",
        family: true,
        staging: false,
        accepts: NOT_A_FUNCTION,
        run: (value, options) => {
            const { root, target, sibling } = stage(options, true)
            return attempt(
                root,
                () => {
                    root.set(sibling, 99)
                    root.set(target, value)
                },
                () => root.get(target),
                () => root.get(sibling),
                value,
            )
        },
    },
    {
        label: "family-txn-set",
        family: true,
        staging: true,
        accepts: NOT_A_FUNCTION,
        run: (value, options) => {
            const { root, target, sibling } = stage(options, true)
            return attempt(
                root,
                () =>
                    root.txn(txn => {
                        txn.set(sibling, 99)
                        txn.set(target, value)
                    }),
                () => root.get(target),
                () => root.get(sibling),
                value,
            )
        },
    },
    {
        label: "family-batch-set",
        family: true,
        staging: true,
        accepts: ANY_VALUE,
        run: (value, options) => {
            const { root, target, sibling } = stage(options, true)
            return attempt(
                root,
                () =>
                    root.txn(txn => {
                        txn.set(sibling, 99)
                        txn.batchSetFamilyAtoms((target as any).family, [
                            [target, value],
                        ])
                    }),
                () => root.get(target),
                () => root.get(sibling),
                value,
            )
        },
    },
    {
        label: "atom-default",
        family: false,
        staging: false,
        accepts: PLAIN_DEFAULT,
        run: (value, options) => {
            // The default value reaches the SAME commit-time policy through
            // resolveAtomDefaultValue -> setValueInData, so it belongs in the
            // invariance set: a default is a written value the user never set.
            const root = store()
            const sibling = atom(0)
            const target = atom<any>(value, options)
            return attempt(
                root,
                () => {
                    root.set(sibling, 99)
                    root.get(target)
                },
                () => root.get(target),
                () => root.get(sibling),
                value,
            )
        },
    },
    {
        label: "family-member-default",
        family: true,
        staging: false,
        accepts: PLAIN_DEFAULT,
        run: (value, options) => {
            const root = store()
            const sibling = atom(0)
            const family = atomFamily<any, [string]>(() => value, options)
            const target = family("member")
            return attempt(
                root,
                () => {
                    root.set(sibling, 99)
                    root.get(target)
                },
                () => root.get(target),
                () => root.get(sibling),
                value,
            )
        },
    },
]

type Failure = { shape: string; mutable: boolean; detail: string }

const runShape = (
    factory: ValueFactory,
    mutable: boolean,
    failures: Failure[],
) => {
    const report = (detail: string) =>
        failures.push({ shape: factory.label, mutable, detail })

    // A never-written instance: the baseline P2 compares against, so an input
    // that arrives already frozen isn't mistaken for a policy violation.
    const pristine = freezeSignature(factory.make())

    const probe = factory.make()
    const outcomes = PATHS.filter(path => path.accepts(probe)).map(path => {
        const value = factory.make()
        const options = mutable ? { mutable: true as const } : {}
        return { path, value, result: path.run(value, options) }
    })
    // A shape no path can express would make P1 vacuously true.
    if (outcomes.length < 2) {
        report(`only ${outcomes.length} path(s) can express this shape`)
        return
    }
    const [first, ...rest] = outcomes
    if (!first) return
    const key = (o: (typeof outcomes)[number]) =>
        JSON.stringify({
            error: o.result.error,
            signature: o.result.signature,
            identity: o.result.identity,
        })
    const firstKey = key(first)
    for (const other of rest) {
        // P1. Two write paths, one policy.
        if (key(other) !== firstKey) {
            report(
                `P1 ${first.path.label} vs ${other.path.label}: ${firstKey} vs ${key(other)}`,
            )
        }
    }

    for (const { path, value, result } of outcomes) {
        const isObjectGraph =
            value !== null &&
            (typeof value === "object" || typeof value === "function")

        if (mutable) {
            // P2. `mutable` opts out entirely — including out of the rejection
            // of unfreezable built-ins, which is the whole reason the option
            // exists.
            if (result.error !== null) {
                report(
                    `P2 ${path.label} threw for a mutable atom: ${result.error}`,
                )
            } else if (
                JSON.stringify(result.signature) !== JSON.stringify(pristine)
            ) {
                report(
                    `P2 ${path.label} changed freeze state of a mutable value: ${JSON.stringify(result.signature)} vs pristine ${JSON.stringify(pristine)}`,
                )
            }
        } else if (result.error === null && isObjectGraph) {
            // P3. Committed without `mutable` means frozen all the way down.
            const live = result.signature!.filter(entry =>
                entry.endsWith("=live"),
            )
            if (live.length > 0) {
                report(`P3 ${path.label} left ${live.join(", ")} unfrozen`)
            }
        }

        // P4. The freeze is in-place; a copy would silently break reference
        // equality for every consumer holding the value they just wrote.
        if (
            result.error === null &&
            isObjectGraph &&
            result.identity !== true
        ) {
            report(`P4 ${path.label} did not commit the caller's reference`)
        }

        // P5. Rejection is atomic for the staging paths and only for them: a
        // direct set is its own commit, so its sibling legitimately lands.
        if (result.error !== null && path.staging && result.siblingLanded) {
            report(
                `P5 ${path.label} rejected the value but committed a sibling write`,
            )
        }
        if (result.error === null && !result.siblingLanded) {
            report(`P5 ${path.label} lost the sibling write on a clean commit`)
        }
    }
}

const format = (failures: Failure[]) =>
    failures.map(f => `[${f.shape}${f.mutable ? " mutable" : ""}] ${f.detail}`)

describe("deep-freeze policy fuzz", () => {
    // The policy is dev-only by design (see IS_PROD): under NODE_ENV=production
    // all three sites skip the freeze, so P3 would be vacuous and P2 trivially
    // true. Both copies read the SAME imported const, so there is no drift to
    // catch on that axis — assert the lane instead of silently passing.
    test("the suite runs in the mode the policy applies to", () => {
        expect(IS_PROD).toBe(false)
    })

    test("every write path applies one freeze policy (named shapes)", () => {
        const failures: Failure[] = []
        for (const factory of CATALOGUE) {
            runShape(factory, false, failures)
            runShape(factory, true, failures)
        }
        expect(format(failures)).toEqual([])
    })

    test("every write path applies one freeze policy (random graphs)", () => {
        // 400 seeded graphs x 11 paths x 2 mutability settings. Enough to cover
        // depth/breadth/back-edge/built-in combinations the catalogue names
        // individually but never mixes.
        const SEEDS = 400
        const failures: Failure[] = []
        for (let seed = 1; seed <= SEEDS; seed++) {
            const factory = randomFactory(seed)
            runShape(factory, false, failures)
            runShape(factory, true, failures)
            // A systemic break would otherwise print thousands of lines.
            if (failures.length >= 10) break
        }
        expect(format(failures)).toEqual([])
        // See the sibling fuzzers: 30s, not Bun's 5s default.
    }, 30_000)

    test("every write path shows the schema an unfrozen value", () => {
        // The OTHER cross-path claim in normalizeStagedValue's contract: "Order
        // is contractual: validate FIRST, then dev-freeze ... so a schema must
        // observe the same (unfrozen) representation no matter which write path
        // delivered the value." The direct paths get that ordering from
        // `setAtom` (validate) + `setValueInData` (freeze) being separate steps;
        // the staging paths get it from the statement order inside
        // normalizeStagedValue. Two mechanisms, one guarantee — so it is worth a
        // check that spans both.
        const failures: string[] = []
        for (const path of PATHS) {
            const value = { nested: { a: 1 } }
            if (!path.accepts(value)) continue
            const observed: string[] = []
            const options: AtomOptions<any> = {
                schemaValidation: true,
                schema: {
                    parse: (candidate: unknown) => {
                        // The atom's own `null` default is validated too. Only
                        // an object graph has freeze state to observe.
                        if (candidate !== null && typeof candidate === "object")
                            observed.push(freezeSignature(candidate).join(" "))
                        return candidate
                    },
                },
            }
            const result = path.run(value, options)
            if (result.error !== null) {
                failures.push(`${path.label} threw: ${result.error}`)
                continue
            }
            if (observed.length === 0) {
                failures.push(`${path.label} never validated the value`)
                continue
            }
            const frozenWhenSeen = observed.filter(
                entry => !entry.includes("=live"),
            )
            if (frozenWhenSeen.length > 0) {
                failures.push(
                    `${path.label} validated an already-frozen value: ${frozenWhenSeen.join(" | ")}`,
                )
            }
        }
        expect(failures).toEqual([])
    })

    test("a staged promise stays usable, and its settled value is frozen", async () => {
        // The one place the two copies deliberately DIFFER: normalizeStagedValue
        // exempts promise-likes (they must stay usable until the async-write
        // coordinator normalizes them at commit), while setValueInData has no
        // such exemption because a promise never reaches it from an atom write.
        // Pinning the difference is as important as pinning the agreement.
        const root = store()
        const target = atom<any>(null)
        const resolved = { deep: { a: 1 } }
        let stagedFrozen: boolean | undefined
        root.txn(txn => {
            txn.set(target, Promise.resolve(resolved))
            stagedFrozen = Object.isFrozen(txn.get(target))
        })
        expect(stagedFrozen).toBe(false)
        await root.get(target)
        expect(freezeSignature(root.get(target))).toEqual([
            "$.deep=frozen",
            "$=frozen",
        ])
    })
})
