/** Shared table-driven runner for the trace oracle. Centralizes the protocol
 *  every case follows so it stays uniform across suites:
 *
 *    1. fresh recorder
 *    2. build the store/atoms/selectors/subscriptions
 *    3. clear() — drop setup evals / cold reads so the trace covers only the op
 *    4. act — perform ONE operation (may be async)
 *    5. assert the trace against the pattern (if given)
 *    6. run any case-specific assertions (values, sources, errors, counts)
 *
 *  `build`/`act`/`assert` may be async, so async-atom / async-selector /
 *  revalidation suites use the same shape as the sync ones. */
import { describe, test } from "../performance/test-compat"
import {
    assertTrace,
    createRecorder,
    type Recorder,
    type TracePattern,
} from "./traceRecorder"

export type TraceCase<Ctx> = {
    name: string
    build: (rec: Recorder) => Ctx | Promise<Ctx>
    act: (ctx: Ctx, rec: Recorder) => void | Promise<void>
    /** Exact tags lock position; nested arrays are order-free bags. Omit when a
     *  case asserts its own trace slices (e.g. multi-commit async settlement). */
    trace?: TracePattern
    /** Case-specific assertions: final values, `onChange` sources/kinds, thrown
     *  errors, evaluation counts. Receives the same ctx and the live recorder. */
    assert?: (ctx: Ctx, rec: Recorder) => void | Promise<void>
}

export const runTraceTable = <Ctx>(
    title: string,
    cases: TraceCase<Ctx>[],
): void => {
    describe(title, () => {
        test.each(cases.map(c => [c.name, c] as const))(
            "%s",
            async (_name, c) => {
                const rec = createRecorder()
                const ctx = await c.build(rec)
                rec.clear()
                await c.act(ctx, rec)
                if (c.trace) assertTrace(rec.events, c.trace)
                await c.assert?.(ctx, rec)
            },
        )
    })
}
