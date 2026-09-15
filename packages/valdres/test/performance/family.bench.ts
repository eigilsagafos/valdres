import { describe, test } from "./test-compat"
import { compare, measureOne } from "./bench-utils"
import { atom as valdresAtom, family as valdresFamily } from "../../src/v1"
import { do_not_optimize } from "mitata"

// v1 family() has no jotai equivalent (jotai-family's positional-tuple/
// encodeKey identity is a different contract), so the reference side of
// each `compare()` here is a hand-rolled Map — the alternative a real
// adopter (ShiftX) keeps in place of family() at these call shapes — rather
// than a library competitor. compare() still gives each pair the same
// BENCH_VALDRES_ONLY-aware treatment as every other benchmark in this
// suite, which matters because this file is swept into the same paired
// PR gate as the rest of test/performance/*.bench.ts.
// See docs/designs/family-identity.md for the beta.36 adoption report.
describe("v1 family() hot path", () => {
    test("encodeKey cache hit", async () => {
        const ref = "ProcessStep/abc123"
        const context = ["ProcessDecisionPath/x", "ProcessDecision/y"]
        const accessor = valdresFamily(
            (_ref: string, _context: readonly string[]) => valdresAtom(0),
            { encodeKey: (r: string, c: readonly string[]) => r + "|" + c.join(",") },
        )
        accessor(ref, context) // prime

        const handRolled = new Map<string, unknown>()
        handRolled.set(ref + "|" + context.join(","), { value: 0 })

        await compare(
            "family(encodeKey) cache hit",
            () => do_not_optimize(accessor(ref, context)),
            () => {
                const key = ref + "|" + context.join(",")
                do_not_optimize(handRolled.get(key))
            },
            "hand-rolled Map",
        )
    })

    test("positional tuple cache hit", async () => {
        const accessor = valdresFamily(
            (_r: string, _a: string, _b: string) => valdresAtom(0),
        )
        accessor("ProcessStep/abc123", "ProcessDecisionPath/x", "ProcessDecision/y") // prime

        // No hand-rolled reference: this shape has no per-call encoding to
        // compare against, so it is tracked as its own valdres-only trend
        // via measureOne, matching e.g. scope.bench.ts's precedent for
        // valdres-only latency.
        await measureOne("family(positional tuple) cache hit / valdres", () =>
            do_not_optimize(
                accessor(
                    "ProcessStep/abc123",
                    "ProcessDecisionPath/x",
                    "ProcessDecision/y",
                ),
            ),
        )
    })

    test("single primitive key cache hit", async () => {
        const accessor = valdresFamily((_id: string) => valdresAtom(0))
        accessor("warm-key") // prime

        const handRolled = new Map<string, unknown>()
        handRolled.set("warm-key", { value: 0 })

        await compare(
            "family(single key) cache hit",
            () => do_not_optimize(accessor("warm-key")),
            () => do_not_optimize(handRolled.get("warm-key")),
            "hand-rolled Map",
        )
    })
})
