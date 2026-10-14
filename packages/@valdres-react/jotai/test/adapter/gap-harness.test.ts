/**
 * Controls for the upstream known-failure gate: it accepts only the
 * documented failure, and rejects unrelated failures, unexpected passes and
 * untrustworthy manifest entries.
 */
import { describe, expect, test } from "bun:test"
import { JotaiCompatibilityError } from "../../src/lib/errors"
import {
    expectKnownFailure,
    manifestProblems,
    type ExpectedFailure,
} from "../upstream/gapCheck"
import { gaps } from "../upstream/gaps"

const LATE_GET = "VALDRES_JOTAI_LATE_GET"
const lateGet = () =>
    new JotaiCompatibilityError(
        LATE_GET,
        "atom2 called get(atom1) after its read function returned.",
    )
// The reviewer's mutation: same message, no code.
const unrelated = () =>
    new TypeError(`UNRELATED REGRESSION ${lateGet().message}`)

const accepts = (expected: ExpectedFailure, run: () => unknown) =>
    expect(
        expectKnownFailure("control", expected, run),
    ).resolves.toBeUndefined()
const rejects = (
    expected: ExpectedFailure,
    run: () => unknown,
    reason: RegExp,
) =>
    expect(expectKnownFailure("control", expected, run)).rejects.toThrow(reason)

describe("documented failures are accepted", () => {
    test("an error carrying the code, directly or in its cause chain", async () => {
        await accepts({ code: LATE_GET }, () => {
            throw lateGet()
        })
        await accepts({ code: LATE_GET }, () => {
            throw new AggregateError([new Error("x", { cause: lateGet() })])
        })
    })

    test("a matching assertion with the documented code observed", async () => {
        await accepts(
            { assertion: /Expected: 2\s+Received: null/, observed: LATE_GET },
            async () => {
                // The adapter observes read-function promises with .then(_, handler).
                Promise.reject(lateGet()).then(undefined, () => {})
                await Promise.resolve()
                expect(null as unknown).toBe(2)
            },
        )
    })

    test("a missing element with the documented DOM", async () => {
        const failure = Object.assign(
            new Error(
                "Unable to find an element with the text: no error. …\n<div>Errored: atom12 called get(atom11) after its read function returned</div>",
            ),
            { name: "TestingLibraryElementError" },
        )
        await accepts(
            {
                missingText: "no error",
                rendered: /Errored: [\s\S]*called get\(atom\d+\)/,
            },
            () => {
                throw failure
            },
        )
    })
})

describe("other failures are rejected", () => {
    test("an unrelated TypeError where a code is documented", async () => {
        await rejects(
            { code: LATE_GET },
            () => {
                throw unrelated()
            },
            /failed differently than documented: expected an error with code VALDRES_JOTAI_LATE_GET; got TypeError: UNRELATED REGRESSION/,
        )
    })

    test("the right assertion without the documented code observed", async () => {
        await rejects(
            { assertion: /Expected: 2\s+Received: null/, observed: LATE_GET },
            async () => {
                Promise.reject(unrelated()).then(undefined, () => {})
                await Promise.resolve()
                expect(null as unknown).toBe(2)
            },
            /expected VALDRES_JOTAI_LATE_GET to be raised during the test/,
        )
    })

    test("a different assertion, or a non-assertion error", async () => {
        await rejects(
            { assertion: /Expected: 2\s+Received: null/ },
            () => expect(1).toBe(2),
            /expected an assertion matching/,
        )
        await rejects(
            { assertion: /Expected: 2/ },
            () => {
                throw new TypeError("Expected: 2")
            },
            /expected an assertion matching/,
        )
    })

    test("a different missing element, or the right one with a broken render", async () => {
        const query = (text: string, dom: string) => () => {
            throw Object.assign(
                new Error(
                    `Unable to find an element with the text: ${text}. …\n${dom}`,
                ),
                {
                    name: "TestingLibraryElementError",
                },
            )
        }
        const expected = { missingText: "no error", rendered: /Errored: / }
        await rejects(
            expected,
            query("count: 1", "<div>Errored: x</div>"),
            /expected a missing "no error"/,
        )
        await rejects(
            expected,
            query("no error", "<body></body>"),
            /expected a missing "no error"/,
        )
    })

    test("an unexpected pass", async () => {
        await rejects({ code: LATE_GET }, () => {}, /Known gap now passes/)
    })
})

describe("the manifest", () => {
    test("every known failure in gaps.ts documents its outcome", () => {
        const all = new Map(
            Object.values(gaps).map(gap => [
                gap.file,
                new Set(Object.keys(gaps)),
            ]),
        )
        expect(manifestProblems(gaps, all)).toEqual([])
        expect(Object.values(gaps).filter(g => !g.skip).length).toBe(47)
        expect(Object.values(gaps).filter(g => g.skip).length).toBe(12)
    })

    test("missing outcomes, files that did not run and unmatched titles fail", () => {
        const manifest = {
            "no outcome": { file: "a.test.ts" },
            "not run": { file: "b.test.ts", expected: { code: LATE_GET } },
            "renamed upstream": {
                file: "a.test.ts",
                expected: { code: LATE_GET },
            },
            "skipped needs no outcome": {
                file: "a.test.ts",
                skip: true as const,
            },
        }
        const registered = new Map([
            ["a.test.ts", new Set(["no outcome", "skipped needs no outcome"])],
        ])
        expect(manifestProblems(manifest, registered)).toEqual([
            'gap "no outcome" has no expected outcome',
            'gap "not run" names b.test.ts, which was not run',
            'a.test.ts: gap "renamed upstream" matches no test',
        ])
    })
})
