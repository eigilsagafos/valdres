/**
 * How a known gap must fail. A known gap is an upstream Jotai test this
 * package is documented not to pass; it still runs, and it must fail in the
 * documented way, not merely fail:
 *
 * - `code`: the thrown value, or something in its `cause`/`errors` chain,
 *   carries this error code (for example `VALDRES_JOTAI_LATE_GET`).
 * - `assertion`: an `expect()` assertion failed and its message (matcher,
 *   expected and received values) matches this pattern.
 * - `missingText` + `rendered`: a Testing Library text query failed for this
 *   exact text while the rendered DOM matches `rendered`, so a different
 *   missing element or a broken setup does not count.
 * - `observed` (with either of the last two): the documented error code was
 *   also raised during the test, so an unrelated error producing the same
 *   symptom does not count.
 */
export type ExpectedFailure = (
    | { readonly code: string }
    | { readonly assertion: RegExp }
    | { readonly missingText: string; readonly rendered: RegExp }
) & {
    /**
     * A code that must also have been raised during the test (a handled
     * rejection or a scheduled callback's throw), for failures whose visible
     * symptom is an assertion.
     */
    readonly observed?: string
}

const chain = (error: unknown, seen = new Set<unknown>()): unknown[] => {
    if (error === null || typeof error !== "object" || seen.has(error)) {
        return [error]
    }
    seen.add(error)
    const nested: unknown[] = [error]
    const { cause, errors } = error as { cause?: unknown; errors?: unknown }
    if (cause !== undefined) nested.push(...chain(cause, seen))
    if (Array.isArray(errors)) {
        for (const inner of errors) nested.push(...chain(inner, seen))
    }
    return nested
}

const messageOf = (error: unknown) =>
    error instanceof Error ? error.message : String(error)

/** One line naming a failure, for mismatch reports. */
export const describeFailure = (error: unknown): string => {
    const codes = chain(error)
        .map(e => (e as { code?: unknown } | null)?.code)
        .filter(code => typeof code === "string")
    const name = error instanceof Error ? error.name : typeof error
    const head = messageOf(error).split("\n").slice(0, 3).join(" | ")
    return `${name}${codes.length ? `[${codes.join(",")}]` : ""}: ${head}`
}

/** Why `failure` is not the expected one, or undefined when it is. */
export const mismatch = (
    failure: unknown,
    expected: ExpectedFailure,
    observed: ReadonlySet<string> = new Set(),
): string | undefined => {
    if (expected.observed !== undefined && !observed.has(expected.observed)) {
        return `expected ${expected.observed} to be raised during the test`
    }
    if ("code" in expected) {
        const codes = chain(failure).map(
            e => (e as { code?: unknown } | null)?.code,
        )
        return codes.includes(expected.code)
            ? undefined
            : `expected an error with code ${expected.code}`
    }
    const message = messageOf(failure)
    if ("assertion" in expected) {
        const isAssertion = /^expect\(/.test(message)
        return isAssertion && expected.assertion.test(message)
            ? undefined
            : `expected an assertion matching ${expected.assertion}`
    }
    const isQuery =
        failure instanceof Error &&
        failure.name === "TestingLibraryElementError" &&
        message.startsWith(
            `Unable to find an element with the text: ${expected.missingText}.`,
        )
    return isQuery && expected.rendered.test(message)
        ? undefined
        : `expected a missing "${expected.missingText}" with a DOM matching ${expected.rendered}`
}

/**
 * Error codes raised while `run` executes, from two places an upstream test
 * cannot see them:
 *
 * - promise rejections passed to a `then` handler: the adapter observes every
 *   promise a read function returns with `.then(ignore, ignore)`, so an error
 *   that rejects an async atom (the usual shape of `VALDRES_JOTAI_LATE_GET`)
 *   is seen even when the test then fails on an assertion;
 * - errors thrown by `setTimeout`, `setInterval` and `queueMicrotask`
 *   callbacks scheduled during the run (rethrown unchanged).
 */
export const observeRejectionCodes = async (
    run: () => unknown,
): Promise<{ codes: Set<string>; outcome: PromiseSettledResult<unknown> }> => {
    const codes = new Set<string>()
    const record = (reason: unknown) => {
        for (const e of chain(reason)) {
            const code = (e as { code?: unknown } | null)?.code
            if (typeof code === "string") codes.add(code)
        }
    }
    const scheduled = ["setTimeout", "setInterval", "queueMicrotask"] as const
    const originalSchedulers = scheduled.map(name => globalThis[name])
    for (const [index, name] of scheduled.entries()) {
        const schedule = originalSchedulers[index] as (
            ...args: unknown[]
        ) => unknown
        ;(globalThis as Record<string, unknown>)[name] = (
            callback: unknown,
            ...rest: unknown[]
        ) =>
            schedule(
                typeof callback === "function"
                    ? (...args: unknown[]) => {
                          try {
                              return callback(...args)
                          } catch (error) {
                              record(error)
                              throw error
                          }
                      }
                    : callback,
                ...rest,
            )
    }
    const original = Promise.prototype.then
    Promise.prototype.then = function (
        this: Promise<unknown>,
        onFulfilled,
        onRejected,
    ) {
        return original.call(
            this,
            onFulfilled,
            typeof onRejected === "function"
                ? (reason: unknown) => {
                      record(reason)
                      return onRejected(reason)
                  }
                : onRejected,
        ) as never
    } as typeof original
    let outcome: PromiseSettledResult<unknown>
    try {
        outcome = { status: "fulfilled", value: await run() }
    } catch (reason) {
        outcome = { status: "rejected", reason }
    } finally {
        Promise.prototype.then = original
        for (const [index, name] of scheduled.entries()) {
            ;(globalThis as Record<string, unknown>)[name] =
                originalSchedulers[index]
        }
    }
    return { codes, outcome }
}

/**
 * Runs a known gap: it must fail, and fail as expected. Returns normally only
 * in that case.
 */
export const expectKnownFailure = async (
    key: string,
    expected: ExpectedFailure,
    run: () => unknown,
): Promise<void> => {
    const { codes, outcome } = await observeRejectionCodes(run)
    if (outcome.status === "fulfilled") {
        throw new Error(
            `Known gap now passes against the adapter: remove "${key}" from test/upstream/gaps.ts`,
        )
    }
    const failure = outcome.reason
    const reason = mismatch(failure, expected, codes)
    if (reason !== undefined) {
        throw new Error(
            `Known gap "${key}" failed differently than documented: ${reason}; got ${describeFailure(failure)}`,
            { cause: failure },
        )
    }
}

interface ManifestEntry {
    readonly file: string
    readonly expected?: ExpectedFailure
    readonly skip?: true
}

/**
 * Manifest entries that cannot be trusted: a known failure without an
 * expected outcome, an entry naming a file that was not run, or an entry whose
 * test was not registered by its file (renamed upstream, or a typo).
 */
export const manifestProblems = (
    gaps: Readonly<Record<string, ManifestEntry>>,
    registered: ReadonlyMap<string, ReadonlySet<string>>,
): string[] => {
    const problems: string[] = []
    for (const [title, gap] of Object.entries(gaps)) {
        if (!gap.skip && gap.expected === undefined) {
            problems.push(`gap "${title}" has no expected outcome`)
        }
        const tests = registered.get(gap.file)
        if (tests === undefined) {
            problems.push(`gap "${title}" names ${gap.file}, which was not run`)
        } else if (!tests.has(title)) {
            problems.push(`${gap.file}: gap "${title}" matches no test`)
        }
    }
    return problems
}
