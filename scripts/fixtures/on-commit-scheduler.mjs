// Run each scenario in its own process: host replacements must not share the
// module scheduler, or a previous test's real timer can hide a lost fake timer.
import { strict as assert } from "node:assert"
const { store } = await import(process.env.ON_COMMIT_MODULE ?? "valdres")
const scenario = process.argv[2]
const realTimeout = globalThis.setTimeout
const realMicrotask = globalThis.queueMicrotask
const tick = () => new Promise(resolve => realTimeout(resolve, 5))
const flush = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve()
}
const first = store(),
    second = store(),
    child = first.scope()
const starts = [],
    expected = []
let sequence = 0
const push = (owner = first) => {
    const id = sequence++
    expected.push(id)
    owner.txn(tx => tx.onCommit(() => starts.push(id)))
}
const burst = () => {
    for (let i = 0; i < 1100; i++) push(i % 2 ? first : second)
}
const complete = async () => {
    for (let i = 0; i < 80 && starts.length < expected.length; i++) await tick()
    assert.deepEqual(
        starts,
        expected,
        "pending callbacks must keep FIFO order and run once",
    )
}
try {
    if (scenario === "control") {
        push()
        burst()
        await complete()
        push(second)
        await complete()
    } else if (scenario === "dropped-microtask") {
        const discarded = []
        globalThis.queueMicrotask = fn => discarded.push(fn)
        push(first)
        burst()
        child.txn(tx =>
            tx.onCommit(() => assert.fail("disposed callback started")),
        )
        child.dispose()
        await flush()
        assert.equal(starts.length, 0)
        globalThis.queueMicrotask = realMicrotask
        push(second) // Later valid registration must restart the shared backlog.
        await complete()
        // Even a host replaying obsolete callbacks must not duplicate delivery.
        for (const wake of discarded) {
            wake()
            wake()
        }
        await complete()
    } else if (scenario === "dropped-timer") {
        await tick() // Allow earlier real reset tasks before replacing the host.
        globalThis.setTimeout = () => 0
        push()
        await flush()
        assert.equal(starts.length, 1)
        globalThis.setTimeout = realTimeout
        // One publication can exhaust the remaining budget with backlog left.
        first.txn(tx => {
            for (let i = 0; i < 1100; i++) {
                const id = sequence++
                expected.push(id)
                tx.onCommit(() => starts.push(id))
            }
        })
        push(second)
        await complete()
        push(second)
        await complete()
    } else if (scenario === "fake-timers") {
        const { jest } = await import("bun:test")
        try {
            for (let round = 0; round < 4; round++) {
                // Required even with process isolation: drain the preceding
                // round's real task before creating a reset task under fake time.
                await tick()
                jest.useFakeTimers()
                push(first)
                await flush()
                jest.useRealTimers() // Discards the pending fake reset task.
                burst()
                const canceled = first.scope()
                canceled.txn(tx =>
                    tx.onCommit(() =>
                        assert.fail("canceled fake-timer callback"),
                    ),
                )
                canceled.dispose()
                push(second)
                await complete()
            }
            await tick()
            jest.useFakeTimers()
            burst()
            await flush()
            assert.ok(
                starts.length < expected.length,
                "fake tasks must be advanced after yielding",
            )
            jest.advanceTimersByTime(10)
            await flush()
            assert.deepEqual(starts, expected)
        } finally {
            jest.useRealTimers()
        }
        push(second)
        await complete()
    } else if (scenario === "duplicate-wakes") {
        const microtasks = [],
            tasks = [],
            retired = []
        let scheduledTasks = 0
        globalThis.queueMicrotask = fn => microtasks.push(fn)
        globalThis.setTimeout = fn => {
            scheduledTasks++
            tasks.push(fn)
            return 0
        }
        const flushWakes = () => {
            // Newest first, then obsolete callbacks, each replayed twice.
            for (const wake of microtasks.splice(0).reverse()) {
                wake()
                wake()
            }
        }
        for (let i = 0; i < 5100; i++) push(i % 2 ? first : second)
        first.txn(tx => tx.onCommit(() => child.dispose()))
        child.txn(tx =>
            tx.onCommit(() => assert.fail("batch cancellation failed")),
        )
        push(second)
        flushWakes()
        assert.equal(starts.length, 1024) // Internal quantum, not a public numeric promise.
        // Simulate losing ALL initial refill attempts; retain them only to
        // replay later as delayed callbacks from an old generation.
        retired.push(...tasks.splice(0))
        for (let i = 0; i < 3; i++) {
            push(second)
            flushWakes()
        }
        assert.equal(
            starts.length,
            1024,
            "publications cannot refill the budget",
        )
        assert.equal(tasks.length, 3, "one recovery attempt per blocked drain")
        // Any surviving attempt can recover, even if a later attempt exists.
        const recoveries = tasks.splice(0)
        recoveries[1]()
        assert.equal(starts.length, 2048)
        retired.push(...recoveries)
        const replayRetired = () => {
            const before = starts.length,
                scheduledBefore = scheduledTasks
            for (const task of retired.slice().reverse()) {
                task()
                task()
            }
            assert.equal(
                starts.length,
                before,
                "old generations cannot replenish a newer budget",
            )
            assert.equal(
                scheduledTasks,
                scheduledBefore,
                "inert tasks cannot schedule retries",
            )
        }
        replayRetired()
        let producerTurns = 0
        while (starts.length < expected.length && producerTurns < 10) {
            // A continuing producer must not invalidate this already-valid
            // refill opportunity. Run the oldest attempt on alternate turns.
            const outstanding = tasks.splice(0)
            assert.ok(outstanding.length > 0)
            push(producerTurns % 2 ? first : second)
            flushWakes()
            const attempts = [...outstanding, ...tasks.splice(0)]
            const before = starts.length
            attempts[producerTurns % 2 ? attempts.length - 1 : 0]()
            assert.ok(
                starts.length > before,
                "backlog must progress while producers remain active",
            )
            assert.ok(starts.length - before <= 1024)
            retired.push(...attempts)
            replayRetired()
            producerTurns++
        }
        assert.deepEqual(starts, expected)
        // Consume the final, otherwise idle reset. No internal retry loop.
        for (const task of tasks.splice(0)) {
            task()
            task()
        }
        flushWakes()
        replayRetired()
        assert.equal(tasks.length, 0)
        assert.equal(microtasks.length, 0)
        console.log(
            JSON.stringify({
                scenario,
                producerTurns,
                scheduledTasks,
                retiredTasks: retired.length,
            }),
        )
    } else if (scenario === "task-producer") {
        await tick()
        const initial = 2000,
            samples = []
        first.txn(tx => {
            for (let i = 0; i < initial; i++) {
                const id = sequence++
                expected.push(id)
                tx.onCommit(() => starts.push(id))
            }
        })
        let turns = 0,
            stopped = false
        try {
            await new Promise((resolve, reject) => {
                const watchdog = realTimeout(
                    () => reject(new Error("producer task deadline")),
                    2000,
                )
                const produce = () => {
                    if (stopped) return
                    push(second)
                    turns++
                    // Sample INSIDE the still-running producer, with more
                    // publications to come. Finishing after it stops is not enough.
                    if (turns === 32 || turns === 64)
                        samples.push({
                            turns,
                            starts: starts.length,
                            stream: Math.max(0, starts.length - initial),
                        })
                    if (turns === 80) {
                        clearTimeout(watchdog)
                        resolve()
                    } else realTimeout(produce, 0)
                }
                produce()
            })
        } finally {
            stopped = true
        }
        console.log(JSON.stringify({ scenario, samples }))
        assert.equal(samples.length, 2)
        assert.ok(
            samples[0].starts > 1024,
            "backlog must progress during the stream",
        )
        assert.ok(
            samples[0].stream > 0,
            "the other Store must progress during the stream",
        )
        assert.ok(
            samples[1].stream > samples[0].stream,
            "progress must continue while producing",
        )
        await complete()
    } else if (scenario === "promise-producer") {
        const tasks = [],
            chain = []
        let scheduledTasks = 0
        globalThis.setTimeout = fn => {
            scheduledTasks++
            tasks.push(fn)
            return 0
        }
        const count = 3500
        const publish = i =>
            (i % 2 ? first : second).txn(tx =>
                tx.onCommit(() => {
                    chain.push(i)
                    if (i + 1 === count) return
                    if (i % 2)
                        publish(i + 1) // Reentrant synchronous publication.
                    else return Promise.resolve().then(() => publish(i + 1))
                }),
            )
        const flushChain = async () => {
            for (let i = 0; i < 8000; i++) await Promise.resolve()
        }
        publish(0)
        await flushChain()
        assert.equal(
            chain.length,
            1024,
            "Promise continuations share the task budget",
        )
        const atRest = scheduledTasks
        await flushChain()
        assert.equal(
            scheduledTasks,
            atRest,
            "blocked work cannot sustain a retry loop",
        )
        let refills = 0
        while (chain.length < count && refills < 5) {
            const attempts = tasks.splice(0)
            assert.ok(attempts.length > 0)
            const before = chain.length
            attempts[refills % 2 ? attempts.length - 1 : 0]()
            await flushChain()
            assert.equal(chain.length, Math.min(before + 1024, count))
            const after = chain.length,
                scheduledBefore = scheduledTasks
            for (const task of attempts.reverse()) {
                task()
                task()
            }
            await flushChain()
            assert.equal(
                chain.length,
                after,
                "duplicate attempts cannot bypass task yielding",
            )
            assert.equal(scheduledTasks, scheduledBefore)
            refills++
        }
        assert.deepEqual(
            chain,
            Array.from({ length: count }, (_, i) => i),
        )
        for (const task of tasks.splice(0)) {
            task()
            task()
        }
        await flushChain()
        assert.equal(tasks.length, 0)
        console.log(
            JSON.stringify({
                scenario,
                scheduledTasks,
                refills,
                chainStarts: chain.length,
            }),
        )
    } else if (scenario === "promise-errors") {
        const oldReport = globalThis.reportError
        const reports = [],
            unhandled = [],
            fallbacks = []
        const callbackErrors = [
            new Error("own catch"),
            new Error("catch getter"),
            new Error("own then"),
        ]
        const trigger = new Error("reporter trigger"),
            reporterError = new Error("reporter rejection")
        const listener = error => unhandled.push(error)
        process.on("unhandledRejection", listener)
        // Catch the deliberate task-thrown fallback without hiding rejections.
        globalThis.setTimeout = (fn, ms, ...args) =>
            realTimeout(() => {
                try {
                    fn(...args)
                } catch (error) {
                    fallbacks.push(error)
                }
            }, ms)
        globalThis.reportError = error => {
            reports.push(error)
            if (error === trigger) {
                const rejected = Promise.reject(reporterError)
                rejected.catch = () => rejected
                return rejected
            }
        }
        try {
            first.txn(tx => {
                tx.onCommit(() => {
                    const rejected = Promise.reject(callbackErrors[0])
                    rejected.catch = () => rejected
                    return rejected
                })
                tx.onCommit(() => {
                    const rejected = Promise.reject(callbackErrors[1])
                    Object.defineProperty(rejected, "catch", {
                        get() {
                            throw new Error("must not read own catch")
                        },
                    })
                    return rejected
                })
                tx.onCommit(() => {
                    const rejected = Promise.reject(callbackErrors[2])
                    rejected.then = () => {
                        throw new Error("must use native promise observation")
                    }
                    return rejected
                })
                tx.onCommit(() => {
                    throw trigger
                })
                tx.onCommit(() => starts.push("after errors"))
            })
            for (let i = 0; i < 8; i++) await tick()
            console.log(
                JSON.stringify({
                    scenario,
                    reports: reports.map(e => e.message),
                    unhandled: unhandled.map(e => e.message),
                    fallbacks: fallbacks.length,
                }),
            )
            assert.deepEqual(unhandled, [])
            assert.equal(reports.length, 4)
            for (const error of [...callbackErrors, trigger])
                assert.equal(reports.filter(e => e === error).length, 1)
            assert.equal(fallbacks.length, 1)
            assert.ok(fallbacks[0] instanceof AggregateError)
            assert.deepEqual(fallbacks[0].errors, [trigger, reporterError])
            assert.deepEqual(starts, ["after errors"])
        } finally {
            globalThis.reportError = oldReport
            process.off("unhandledRejection", listener)
        }
    } else throw new Error("Unknown scheduler scenario: " + scenario)
    console.log(
        JSON.stringify({ scenario, status: "passed", starts: starts.length }),
    )
} finally {
    globalThis.setTimeout = realTimeout
    globalThis.queueMicrotask = realMicrotask
    first.dispose()
    second.dispose()
}
