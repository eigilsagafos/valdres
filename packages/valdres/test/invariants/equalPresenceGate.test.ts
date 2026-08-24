import { readFileSync, readdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "../performance/test-compat"

/**
 * Source gate over the presence precondition every equal-gated skip needs.
 *
 * `data.values.get()` returns `undefined` both for a committed `undefined` and
 * for nothing committed, so an equality that skips a write has to establish
 * presence before it trusts the comparison. `hasCommittedValue` is that
 * precondition. Three separate bugs came from asking it ad hoc or not at all (a
 * scope's missing shadow, a selector's lost memoization, and `equal` invoked
 * with the absent sentinel), so this gate has two independent parts:
 *
 *   1. THE PREDICATE. The two-term idiom `x === undefined && !d.values.has(s)`
 *      may not be hand-spelled anywhere in `src/` outside the primitive. This
 *      catches the predicate being re-invented wherever it is used, and needs no
 *      knowledge of comparators at all.
 *   2. THE COMPARATORS. Every `equal(` call in production `src/` is classified,
 *      and each classification is checked against the source:
 *
 *      gated           — `hasCommittedValue(...)` runs BEFORE the comparison in
 *                        the same function. Gating, not post-filtering: the
 *                        comparator is never reached with the absent sentinel,
 *                        which is what `EqualFunc<Value>` promises by typing
 *                        both operands `Value`.
 *      shadow-pin      — the compared operand cannot be absent, and what the
 *                        presence question decides is a write in the EQUAL
 *                        branch (a scope shadow). The check therefore has to
 *                        look after the comparison, where that decision lives.
 *      caller-gated    — the module cannot read a store's values at all, so the
 *                        compared value can only be what a gated caller handed
 *                        it.
 *      resolved-read   — the compared value is a resolved read (`getState`, a
 *                        declared default), never a raw `values.get`.
 *      presence-proven — the compared value IS a raw `values.get`, but a
 *                        `values.has` probe already bailed out on absence
 *                        earlier in the same function.
 *
 * One rule is derived from the source rather than declared, so a new site cannot
 * escape by claiming the wrong kind: whenever the compared operand is assigned
 * from `values.get(`, presence must have been settled first.
 *
 * KNOWN LIMITS — this is a lint, not a proof. It does NOT catch: a comparator
 * reached through an alias (`const eq = atom.equal; eq(a, b)`); a gate that
 * probes a DIFFERENT store than the value was read from
 * (`hasCommittedValue(a, dataA, dataB.values.get(a))`); a `values.has` probe on
 * a different state than the one compared; or a `caller-gated` module's claim
 * that the named caller is its only entry point (that one is verified by hand).
 * Deleting an existing check is caught by behaviour tests, not here:
 * `scope.test.ts` fails if setAtom's shadow pin goes away, and
 * `hasCommittedValue.test.ts` fails if cacheController's gate does.
 *
 * Every check is proven falsifiable at the bottom of this file against synthetic
 * modules — a gate that can only pass proves nothing.
 */

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..")

type EqualCallKind =
    | "gated"
    | "shadow-pin"
    | "caller-gated"
    | "resolved-read"
    | "presence-proven"

type ManifestEntry = {
    /** Package-relative module path. */
    file: string
    /** Enclosing function — the window every mechanical check runs over. */
    fn: string
    /** Text of the compared (first) argument, whitespace-normalized. */
    operand: string
    kind: EqualCallKind
    /** How many calls in that function compare this operand. */
    sites?: number
    /** `caller-gated`: the module whose gate covers this call. */
    gatedBy?: string
    /** `resolved-read`: the non-store source the operand comes from. */
    source?: string
    why: string
}

const MANIFEST: ManifestEntry[] = [
    {
        file: "src/lib/initSelector.ts",
        fn: "initSelector",
        operand: "existingValue as V",
        kind: "gated",
        why:
            "First evaluation has no entry. Comparing against it commits nothing, " +
            "leaving the selector permanently unmemoized.",
    },
    {
        file: "src/lib/propagateUpdatedAtoms.ts",
        fn: "reEvaluateSelector",
        operand: "existingValue",
        kind: "gated",
        why:
            "A missing entry here means the previous evaluation threw; treating it " +
            "as a committed undefined suppresses the recovery notification.",
    },
    {
        file: "src/lib/cacheController.ts",
        fn: "publishGlobalWrite",
        operand: "currentValue",
        kind: "gated",
        why:
            "A peer store may never have read the atom, and `unset` drops an entry " +
            "while the subscription that retains the timer stays alive.",
    },
    {
        file: "src/lib/cacheController.ts",
        fn: "setAndPropagate",
        operand: "currentValue",
        kind: "gated",
        why: "Same as publishGlobalWrite, for the single-store revalidation path.",
    },
    {
        file: "src/lib/transaction.ts",
        fn: "applyFamilyIndexResets",
        operand: "before",
        kind: "gated",
        why:
            "`observeFamilyIndex` is `| undefined`: a family this store never " +
            "committed an index for reverts with nothing to compare against. The " +
            "gate is captured at the READ, because the revert's own write lands in " +
            "the same map before the comparison.",
    },
    {
        file: "src/lib/setAtom.ts",
        fn: "setAtom",
        operand: "currentValue",
        kind: "shadow-pin",
        why:
            "The operand is never absent — a values.get behind a has, otherwise a " +
            "getState read-through. What presence decides here is the SCOPE SHADOW " +
            "an equal-value set must still pin, so the check lives in the equal " +
            "branch, after the comparison. A gate before it would be about nothing.",
    },
    {
        file: "src/lib/treeTriggerGroups.ts",
        fn: "treeEqualAcrossGroups",
        operand: "existingValue",
        kind: "caller-gated",
        sites: 2,
        gatedBy: "src/lib/propagateUpdatedAtoms.ts",
        why:
            "One comparator call per reaching provenance group, all with the value " +
            "reEvaluateSelector gated — verified by hand as the only caller. Gating " +
            "there covers every group; a post-filter there would cover none.",
    },
    {
        file: "src/lib/globalAtomFanOut.ts",
        fn: "preparePeerValue",
        operand: "currentValue",
        kind: "resolved-read",
        source: "getState(",
        why: "Peer synchronization compares against the peer's resolved read.",
    },
    {
        file: "src/lib/globalAtomFanOut.ts",
        fn: "tryApplyUnobservedGlobalSet",
        operand: "currentValue",
        kind: "presence-proven",
        why:
            "The first loop bails unless EVERY registered store already holds a " +
            "value. The second iterates `atom.stores` LIVE while calling " +
            "setValueInData, so a store attached mid-loop would be compared " +
            "unprobed — unreachable only because that same first loop rejects any " +
            "store with subscriptions (no reRoot, hence no user code) and the entry " +
            "condition rejects object and function values (no deepFreeze getters). " +
            "Both preconditions, not the probe alone, are what make this safe.",
    },
    {
        file: "src/lib/writeAtoms.ts",
        fn: "writeAtoms",
        operand: "currentValue",
        kind: "resolved-read",
        source: "getState(",
        why:
            "The transaction write phase compares against a resolved read. Its " +
            "equal branch pins the scope shadow on `!data.values.has(atom)` — the " +
            "same question setAtom asks through the primitive.",
    },
    {
        file: "src/lib/setAtoms.ts",
        fn: "tryWriteFreshSimpleAtoms",
        operand: "atom.defaultValue",
        kind: "resolved-read",
        source: ".defaultValue",
        why:
            "The seed fast path bails on any atom that already has a value, then " +
            "lands the declared default and compares against that.",
    },
]

/**
 * Blank comments, string bodies, and regex literals (preserving offsets and line
 * structure) so only code is scanned. A comment must not be able to introduce a
 * call site or satisfy a gate; a string body must not either (an error message
 * or a doc string may quote `equal(`); and a regex literal has to be skipped
 * whole, or an ordinary `/^https:\/\//` reads as a `//` comment and blanks the
 * rest of its line.
 */
const blankNonCode = (source: string): string => {
    const out = source.split("")
    const blank = (from: number, to: number) => {
        for (let j = from; j < to && j < out.length; j++) {
            if (out[j] !== "\n") out[j] = " "
        }
    }
    let i = 0
    // Last significant code character, to tell a regex literal from division.
    let prev = "\n"
    while (i < source.length) {
        const char = source[i]!
        const next = source[i + 1]
        if (char === '"' || char === "'" || char === "`") {
            const start = i
            i++
            while (i < source.length) {
                if (source[i] === "\\") i += 2
                else if (source[i] === char) {
                    i++
                    break
                } else i++
            }
            blank(start + 1, i - 1)
            prev = char
            continue
        }
        // `//` and `/*` are always comments: a regex literal can begin with
        // neither (`//` is a comment by spec, `/*` cannot open a valid pattern).
        if (char === "/" && (next === "/" || next === "*")) {
            let stop: number
            if (next === "/") {
                const eol = source.indexOf("\n", i)
                stop = eol === -1 ? source.length : eol
            } else {
                const close = source.indexOf("*/", i + 2)
                stop = close === -1 ? source.length : close + 2
            }
            blank(i, stop)
            i = stop
            continue
        }
        if (char === "/" && !/[\w$)\]]/.test(prev)) {
            const start = i
            i++
            let inClass = false
            while (i < source.length) {
                const c = source[i]!
                if (c === "\\") {
                    i += 2
                    continue
                }
                if (c === "\n") break
                if (c === "[") inClass = true
                else if (c === "]") inClass = false
                else if (c === "/" && !inClass) {
                    i++
                    break
                }
                i++
            }
            blank(start + 1, i - 1)
            prev = "/"
            continue
        }
        if (!/\s/.test(char)) prev = char
        i++
    }
    return out.join("")
}

const collectProductionModules = (dir: string, acc: string[] = []) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name)
        if (entry.isDirectory()) collectProductionModules(path, acc)
        else if (entry.name.endsWith(".ts") && !entry.name.includes(".test.ts"))
            acc.push(resolve(path).slice(PACKAGE_ROOT.length + 1))
    }
    return acc.sort()
}

const MODULES = collectProductionModules(join(PACKAGE_ROOT, "src")).map(
    file => {
        const raw = readFileSync(join(PACKAGE_ROOT, file), "utf8")
        return { file, raw, code: blankNonCode(raw) }
    },
)

// ——— Part 1: the predicate ———

// `x === undefined && !d.values.has(s)` / `x !== undefined || d.values.has(s)`
// — the two-term presence test, in either polarity and either order.
const IDIOM = [
    /(?:===|!==)\s*undefined\s*(?:&&|\|\|)\s*!?\s*[\w$.]*\.values\.has\(/,
    /\.values\.has\([^)]*\)\s*(?:&&|\|\|)\s*!?\s*[\w$.]*\s*(?:===|!==)\s*undefined/,
]

const handSpelledPredicates = (
    modules: { file: string; code: string }[],
): string[] =>
    modules
        .filter(
            module =>
                module.file !== "src/lib/hasCommittedValue.ts" &&
                IDIOM.some(pattern => pattern.test(module.code)),
        )
        .map(module => module.file)

// ——— Part 2: the comparators ———

// An arrow assigned to a binding (`const publishGlobalWrite = (`, including a
// generic one) or a function declaration. A local `const areEqual = …` binding
// is deliberately not a function start, so the window is the enclosing function
// body rather than the statement.
const ARROW_FN =
    /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*(?::[^=]*)?=\s*(?:async\s+)?(?:<[^>]*>\s*)?\(/
const FUNCTION_FN = /^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z0-9_$]+)/

/** Text of the first argument of a call whose `(` is at `openParen`. */
const firstArgument = (source: string, openParen: number): string => {
    let depth = 0
    for (let i = openParen; i < source.length; i++) {
        const char = source[i]!
        if (char === "(" || char === "[" || char === "{") depth++
        else if (char === ")" || char === "]" || char === "}") {
            depth--
            if (depth === 0) return source.slice(openParen + 1, i).trim()
        } else if (char === "," && depth === 1) {
            return source.slice(openParen + 1, i).trim()
        }
    }
    return ""
}

/** End of the block opened after `fnStart`, or the end of the call's line for an
 *  expression-bodied arrow. Braces in comments/strings are already blanked. */
const functionEnd = (code: string, fnStart: number, callIndex: number) => {
    const open = code.indexOf("{", fnStart)
    if (open === -1 || open > callIndex) {
        const eol = code.indexOf("\n", callIndex)
        return eol === -1 ? code.length : eol
    }
    let depth = 0
    for (let i = open; i < code.length; i++) {
        if (code[i] === "{") depth++
        else if (code[i] === "}" && --depth === 0) return i
    }
    return code.length
}

type EqualCall = {
    file: string
    line: number
    fn: string
    operand: string
    /** Enclosing function start → the call. */
    before: string
    /** The call → the end of the enclosing function. */
    after: string
    /** The whole module, non-code blanked. */
    module: string
    importsPrimitive: boolean
}

const scanModule = (
    file: string,
    raw: string,
    code = blankNonCode(raw),
): EqualCall[] => {
    const lines = code.split("\n")
    const lineStarts: number[] = []
    let offset = 0
    for (const line of lines) {
        lineStarts.push(offset)
        offset += line.length + 1
    }
    const importsPrimitive =
        raw.includes('from "./hasCommittedValue"') ||
        raw.includes('from "../lib/hasCommittedValue"')
    const calls: EqualCall[] = []
    // `\bequal(` — not `.equal(` — so a bare call to the imported comparator is
    // seen too. `isEqual(` / `treeEqualAcrossGroups(` do not match.
    const pattern = /\bequal\(/g
    let match: RegExpExecArray | null
    while ((match = pattern.exec(code))) {
        const lineIndex = code.slice(0, match.index).split("\n").length - 1
        let fn = "<module>"
        let fnLine = 0
        for (let i = lineIndex; i >= 0; i--) {
            const found =
                ARROW_FN.exec(lines[i]!) ?? FUNCTION_FN.exec(lines[i]!)
            if (found) {
                fn = found[1]!
                fnLine = i
                break
            }
        }
        const fnStart = lineStarts[fnLine]!
        calls.push({
            file,
            line: lineIndex + 1,
            fn,
            operand: firstArgument(code, match.index + "equal".length).replace(
                /\s+/g,
                " ",
            ),
            before: code.slice(fnStart, match.index),
            after: code.slice(
                match.index,
                functionEnd(code, fnStart, match.index),
            ),
            module: code,
            importsPrimitive,
        })
    }
    return calls
}

const key = (call: { file: string; fn: string; operand: string }) =>
    `${call.file} ${call.fn}(…) equal(${call.operand})`

/** Last assignment of `operand` before the call, or undefined for a parameter. */
const assignmentOf = (call: EqualCall): string | undefined => {
    const name = call.operand.replace(/\s+as\s+\w+$/, "")
    if (!/^[A-Za-z0-9_$]+$/.test(name)) return undefined
    const pattern = new RegExp(
        `(?:const|let|var)\\s+${name}\\s*(?::[^=\\n]*)?=\\s*([^\\n]*(?:\\n\\s+[^\\n]*)*?)(?=\\n\\s*(?:const|let|var|return|if|for|while|}|$))`,
        "g",
    )
    const matches = [...call.before.matchAll(pattern)]
    return matches.length === 0 ? undefined : matches[matches.length - 1]![1]
}

/**
 * Why the classification holds — or the reasons it doesn't. One violation
 * string per broken claim, so a failure names the missing precondition.
 */
const violationsFor = (
    entry: ManifestEntry,
    call: EqualCall,
    manifest: ManifestEntry[] = MANIFEST,
): string[] => {
    const violations: string[] = []
    const requireImport = () => {
        if (!call.importsPrimitive)
            violations.push("does not import the shared presence primitive")
    }
    if (entry.kind === "gated") {
        // Before, not after: `hasCommittedValue(…) && equal(…)` never reaches
        // the comparator with an absent entry, while `equal(…) &&
        // hasCommittedValue(…)` calls it and throws away the answer.
        if (!call.before.includes("hasCommittedValue("))
            violations.push(
                "no hasCommittedValue() before the comparison — a post-filter " +
                    "afterwards still hands the comparator the absent sentinel",
            )
        requireImport()
    } else if (entry.kind === "shadow-pin") {
        // The decision this presence question drives happens in the equal
        // branch, so the check must be after the comparison, not before it.
        if (!call.after.includes("hasCommittedValue("))
            violations.push(
                "no hasCommittedValue() in the equal branch — the write that " +
                    "presence decides here is unguarded",
            )
        // And the operand must genuinely be one that cannot be absent.
        if (
            !/\.values\.has\(/.test(call.before) &&
            !/getState\(/.test(call.before)
        )
            violations.push(
                "operand is not shown to be present-or-resolved, so the " +
                    "comparison itself needs a gate",
            )
        requireImport()
    } else if (entry.kind === "caller-gated") {
        if (/\.values\./.test(call.module))
            violations.push(
                "reads a store's values directly, so it no longer only sees " +
                    "what a gated caller handed it",
            )
        if (
            !manifest.some(
                other => other.file === entry.gatedBy && other.kind === "gated",
            )
        )
            violations.push(`gatedBy ${entry.gatedBy} is not itself gated`)
    } else if (entry.kind === "resolved-read") {
        const provenance =
            assignmentOf(call) ?? `${call.operand} (operand text)`
        if (!`${provenance} ${call.operand}`.includes(entry.source!))
            violations.push(
                `operand does not come from ${entry.source} (found: ${provenance})`,
            )
        if (provenance.includes(".values.get("))
            violations.push(
                "operand IS a raw values.get — it needs a presence gate, not a " +
                    "resolved-read classification",
            )
    } else {
        // presence-proven: a values.has probe bails on absence before the
        // compared value is read.
        const has = call.before.search(/\.values\.has\(/)
        const get = call.before.lastIndexOf(".values.get(")
        if (has < 0) violations.push("no values.has probe in the function")
        else if (get < has)
            violations.push("the values.get read precedes the presence probe")
        else if (
            !/return false|continue|return\b/.test(call.before.slice(has, get))
        )
            violations.push("the presence probe does not bail out on absence")
    }
    return violations
}

/** Comparisons against a raw `values.get` with the presence question unasked.
 *  Derived from the source, so a wrong classification cannot hide one. */
const ungatedStoredComparisons = (calls: EqualCall[]): string[] =>
    calls
        .filter(
            call =>
                /\.values\.get\(/.test(assignmentOf(call) ?? "") &&
                !call.before.includes("hasCommittedValue(") &&
                !/\.values\.has\(/.test(call.before),
        )
        .map(key)

const CALLS = MODULES.flatMap(module =>
    scanModule(module.file, module.raw, module.code),
)

describe("the presence predicate lives in one place", () => {
    test("no module hand-spells the two-term presence test", () => {
        // Re-spelling it is how the idiom reached five sites in the first place,
        // and the equal-site census below cannot see a copy that isn't next to
        // a comparator — dehydrate's two were not.
        expect(handSpelledPredicates(MODULES)).toEqual([])
    })
})

describe("equal-gated skips establish presence first", () => {
    test("every production `equal` call is classified", () => {
        const found = CALLS.map(key).sort()
        const declared = MANIFEST.flatMap(entry =>
            Array.from({ length: entry.sites ?? 1 }, () => key(entry)),
        ).sort()
        // A new, moved, or renamed call site lands here first: classify it in
        // MANIFEST (and gate it, if it compares against a stored value).
        expect(found).toEqual(declared)
    })

    test("the scan actually found the known call sites", () => {
        // Fail-closed check on the blanker and the window finder: if either
        // broke, call sites would go missing rather than misclassify.
        expect(CALLS.length).toBeGreaterThanOrEqual(12)
        expect(CALLS.every(call => call.operand.length > 0)).toBe(true)
        expect(CALLS.every(call => call.fn !== "<module>")).toBe(true)
    })

    for (const entry of MANIFEST) {
        test(`${key(entry)} is ${entry.kind}`, () => {
            const matching = CALLS.filter(call => key(call) === key(entry))
            expect(matching.length).toBe(entry.sites ?? 1)
            for (const call of matching) {
                expect(violationsFor(entry, call)).toEqual([])
            }
        })
    }

    test("a stored-value comparison is never left ungated", () => {
        expect(ungatedStoredComparisons(CALLS)).toEqual([])
    })

    test("EqualFunc keeps both operands non-optional", () => {
        // The runtime honours this signature; widening it to `Value | undefined`
        // would push the defensiveness into every consumer's comparator.
        const source = readFileSync(
            join(PACKAGE_ROOT, "src/types/EqualFunc.ts"),
            "utf8",
        )
        expect(source).toContain("a: Value,")
        expect(source).toContain("b: Value,")
        expect(source).not.toContain("Value | undefined")
        expect(source).not.toContain("a?: Value")
    })
})

// Each check below is fed a synthetic module that breaks exactly one
// precondition, proving the gate reports it. Without these, a scanner that
// silently found nothing would look like a clean codebase.
describe("the gate is falsifiable", () => {
    const one = (source: string) =>
        scanModule("src/lib/synthetic.ts", source)[0]!
    const entryFor = (
        kind: EqualCallKind,
        extra: Partial<ManifestEntry> = {},
    ) =>
        ({
            file: "src/lib/synthetic.ts",
            fn: "write",
            operand: "current",
            kind,
            why: "synthetic",
            ...extra,
        }) as ManifestEntry

    const IMPORT = 'import { hasCommittedValue } from "./hasCommittedValue"\n'

    const POST_FILTERED = `${IMPORT}
const write = (atom, value, data) => {
    const current = data.values.get(atom)
    if (atom.equal(current, value) && hasCommittedValue(atom, data, current)) return
    setValueInData(atom, value, data)
}`

    const GATED = `${IMPORT}
const write = (atom, value, data) => {
    const current = data.values.get(atom)
    if (hasCommittedValue(atom, data, current) && atom.equal(current, value)) return
    setValueInData(atom, value, data)
}`

    const UNGATED = `
const write = (atom, value, data) => {
    const current = data.values.get(atom)
    if (atom.equal(current, value)) return
    setValueInData(atom, value, data)
}`

    test("post-filtering does not count as gating", () => {
        expect(violationsFor(entryFor("gated"), one(POST_FILTERED))).toEqual([
            expect.stringContaining("no hasCommittedValue() before"),
        ])
        expect(violationsFor(entryFor("gated"), one(GATED))).toEqual([])
    })

    test("an ungated stored comparison is reported, gated is not", () => {
        expect(
            ungatedStoredComparisons(scanModule("src/lib/s.ts", UNGATED)),
        ).toEqual(["src/lib/s.ts write(…) equal(current)"])
        expect(
            ungatedStoredComparisons(scanModule("src/lib/s.ts", GATED)),
        ).toEqual([])
    })

    test("a bare `equal(a, b)` call is a call site too", () => {
        // `equal` is imported in several modules, so an ungated skip would be
        // one keystroke away from invisible to a `.equal(`-only scan.
        const BARE = `
import { equal } from "./equal"
const write = (atom, value, data) => {
    const current = data.values.get(atom)
    if (equal(current, value)) return
}`
        expect(scanModule("src/lib/s.ts", BARE).map(key)).toEqual([
            "src/lib/s.ts write(…) equal(current)",
        ])
    })

    test("shadow-pin requires the check in the EQUAL branch", () => {
        // The setAtom shape: the operand cannot be absent, and the presence
        // question guards the write the equal branch performs. A gate BEFORE the
        // comparison must not satisfy it — that hole let setAtom's real check be
        // deleted with the whole gate still green.
        const PINNED = `${IMPORT}
const write = (atom, value, data) => {
    const current = getState(atom, data, new Set())
    if (atom.equal(current, value)) {
        if (data.parent && !hasCommittedValue(atom, data)) {
            return setValueInData(atom, value, data)
        }
        return value
    }
}`
        const PIN_DELETED = `${IMPORT}
const write = (atom, value, data) => {
    const current = getState(atom, data, new Set())
    if (hasCommittedValue(atom, data)) return value
    if (atom.equal(current, value)) {
        return value
    }
}`
        expect(violationsFor(entryFor("shadow-pin"), one(PINNED))).toEqual([])
        expect(violationsFor(entryFor("shadow-pin"), one(PIN_DELETED))).toEqual(
            [
                expect.stringContaining(
                    "no hasCommittedValue() in the equal branch",
                ),
            ],
        )
    })

    test("shadow-pin requires an operand that cannot be absent", () => {
        const RAW_OPERAND = `${IMPORT}
const write = (atom, value, data) => {
    const current = data.values.get(atom)
    if (atom.equal(current, value)) {
        if (!hasCommittedValue(atom, data)) return setValueInData(atom, value, data)
    }
}`
        expect(violationsFor(entryFor("shadow-pin"), one(RAW_OPERAND))).toEqual(
            [expect.stringContaining("not shown to be present-or-resolved")],
        )
    })

    test("a comment cannot satisfy the gate", () => {
        const COMMENTED = `
const write = (atom, value, data) => {
    const current = data.values.get(atom)
    // Presence is obvious here, so hasCommittedValue(atom, data) is redundant.
    if (atom.equal(current, value)) return
}`
        expect(violationsFor(entryFor("gated"), one(COMMENTED))).toEqual([
            expect.stringContaining("no hasCommittedValue() before"),
            expect.stringContaining("does not import"),
        ])
    })

    test("neither a comment nor a string introduces a call site", () => {
        const QUOTED = `
const write = (atom, value, data) => {
    /* atom.equal(current, value) would be wrong here. */
    throw new Error("call equal(a, b) instead")
}`
        expect(scanModule("src/lib/s.ts", QUOTED)).toEqual([])
    })

    test("a regex literal does not blank the code after it", () => {
        // `/^https:\/\//` used to read as a `//` comment and blank the rest of
        // the line; an unterminated `/*` inside a pattern blanked the rest of
        // the module, hiding every later call site.
        const WITH_REGEX = `${IMPORT}
const write = (atom, value, data, url) => {
    const current = data.values.get(atom)
    if (!/^https:\\/\\//.test(url) && /x\\/*y/.test(url)) return
    if (hasCommittedValue(atom, data, current) && atom.equal(current, value)) return
}`
        const calls = scanModule("src/lib/s.ts", WITH_REGEX)
        expect(calls.map(key)).toEqual(["src/lib/s.ts write(…) equal(current)"])
        expect(violationsFor(entryFor("gated"), calls[0]!)).toEqual([])
    })

    test("caller-gated must not read a store's values", () => {
        const READS_VALUES = `
const write = (atom, value, data) => {
    const current = data.values.get(atom)
    return atom.equal(current, value)
}`
        const HANDED = `
const write = (atom, current, value) => atom.equal(current, value)`
        const entry = entryFor("caller-gated", {
            gatedBy: "src/lib/initSelector.ts",
        })
        expect(violationsFor(entry, one(READS_VALUES))).toEqual([
            expect.stringContaining("reads a store's values directly"),
        ])
        expect(violationsFor(entry, one(HANDED))).toEqual([])
    })

    test("caller-gated must name a gate that exists", () => {
        const HANDED = `
const write = (atom, current, value) => atom.equal(current, value)`
        expect(
            violationsFor(
                entryFor("caller-gated", { gatedBy: "src/lib/nowhere.ts" }),
                one(HANDED),
            ),
        ).toEqual([expect.stringContaining("is not itself gated")])
    })

    test("resolved-read cannot cover a values.get operand", () => {
        const RESOLVED = `
const write = (atom, value, data) => {
    const current = getState(atom, data, new Set())
    return atom.equal(current, value)
}`
        const entry = entryFor("resolved-read", { source: "getState(" })
        expect(violationsFor(entry, one(UNGATED))).toEqual([
            expect.stringContaining("does not come from getState("),
            expect.stringContaining("IS a raw values.get"),
        ])
        expect(violationsFor(entry, one(RESOLVED))).toEqual([])
    })

    test("presence-proven needs a probe that bails before the read", () => {
        const NO_BAIL = `
const write = (atom, value, data) => {
    const present = data.values.has(atom)
    const current = data.values.get(atom)
    return present && atom.equal(current, value)
}`
        const PROVEN = `
const write = (atom, value, data) => {
    if (!data.values.has(atom)) return false
    const current = data.values.get(atom)
    return atom.equal(current, value)
}`
        expect(
            violationsFor(entryFor("presence-proven"), one(UNGATED)),
        ).toEqual([expect.stringContaining("no values.has probe")])
        expect(
            violationsFor(entryFor("presence-proven"), one(NO_BAIL)),
        ).toEqual([expect.stringContaining("does not bail out on absence")])
        expect(violationsFor(entryFor("presence-proven"), one(PROVEN))).toEqual(
            [],
        )
    })

    test("the window is the enclosing function, not the whole module", () => {
        // A gate in a NEIGHBOURING function must not satisfy this one.
        const NEIGHBOUR = `${IMPORT}
const other = (atom, data) => hasCommittedValue(atom, data)
const write = (atom, value, data) => {
    const current = data.values.get(atom)
    return atom.equal(current, value)
}`
        const call = one(NEIGHBOUR)
        expect(call.fn).toBe("write")
        expect(violationsFor(entryFor("gated"), call)).toEqual([
            expect.stringContaining("no hasCommittedValue() before"),
        ])
    })

    test("a hand-spelled predicate is reported in either polarity", () => {
        const spelled = [
            "if (value === undefined && !data.values.has(state)) return",
            "const present = value !== undefined || data.values.has(state)",
            "if (!data.values.has(state) && value === undefined) return",
        ]
        for (const code of spelled) {
            expect(
                handSpelledPredicates([
                    { file: "src/lib/s.ts", code: blankNonCode(code) },
                ]),
            ).toEqual(["src/lib/s.ts"])
        }
        expect(
            handSpelledPredicates([
                {
                    file: "src/lib/s.ts",
                    code: blankNonCode(
                        "if (!hasCommittedValue(state, data, value)) return",
                    ),
                },
            ]),
        ).toEqual([])
    })

    test("the predicate check ignores comments and the primitive itself", () => {
        expect(
            handSpelledPredicates([
                {
                    file: "src/lib/s.ts",
                    code: blankNonCode(
                        "// was: value === undefined && !data.values.has(state)\nreturn 1",
                    ),
                },
                {
                    file: "src/lib/hasCommittedValue.ts",
                    code: blankNonCode(
                        "export const hasCommittedValue = (s, d, v) => v !== undefined || d.values.has(s)",
                    ),
                },
            ]),
        ).toEqual([])
    })
})
