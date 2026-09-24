import { describe, expect, test } from "bun:test"
import {
    SubscriberNotificationError,
    atom,
    externalAtom,
    selector,
    store,
} from "../../src/index"
import {
    createInspectableStore,
    type CommitInspection,
    type InspectionExport,
    type OperationInspection,
} from "../../src/inspect"

const commits = (report: InspectionExport): readonly CommitInspection[] =>
    report.summaries.filter(
        (summary): summary is CommitInspection => summary.type === "commit",
    )

const operations = (report: InspectionExport): readonly OperationInspection[] =>
    report.summaries.filter(
        (summary): summary is OperationInspection =>
            summary.type === "operation",
    )

describe("valdres/inspect: Store reactions", () => {
    test("records reaction commits inside the initiating operation", () => {
        const input = atom(0, { name: "reaction-inspect/input" })
        const result = atom(0, { name: "reaction-inspect/result" })
        const other = atom(0, { name: "reaction-inspect/other" })
        const { store: target, inspect } = createInspectableStore()
        const notified: number[] = []
        target.sub(result, () => notified.push(target.get(result)))
        target.react(input, tx => {
            tx.set(result, tx.get(input) * 10)
            tx.set(other, 1)
        })
        target.react(input, () => undefined) // no intents

        inspect.reset()
        target.set(input, 2)
        const report = inspect.export()

        expect(notified).toEqual([20])
        const [operation] = operations(report)
        expect(operations(report)).toHaveLength(1)
        expect(operation).toMatchObject({
            operation: "set",
            result: "returned",
            effect: "committed",
        })
        const all = commits(report)
        expect(all).toHaveLength(3)
        const initiating = all.find(
            commit => commit.commitId === operation!.commitId,
        )
        expect(initiating).toMatchObject({
            operationId: operation!.operationId,
            intents: 1,
            notificationsCompleted: true,
        })
        expect(initiating!.reaction).toBeUndefined()
        const reactions = all.filter(commit => commit.reaction === true)
        expect(reactions).toHaveLength(2)
        expect(reactions[0]).toMatchObject({
            operationId: operation!.operationId,
            intents: 2,
            sourceApplied: true,
            notificationsCompleted: false,
            result: "returned",
        })
        expect(reactions[1]).toMatchObject({
            intents: 0,
            sourceApplied: false,
            result: "returned",
        })
        expect("result" in initiating!).toBe(false)
        // Reaction commits close before the initiating commit.
        for (const reaction of reactions) {
            expect(reaction.seqEnd).toBeLessThan(initiating!.seqEnd)
            expect(reaction.scope).toMatchObject({ kind: "scope" })
        }
        expect(JSON.parse(JSON.stringify(report))).toEqual(report)
    })

    test("records failed reactions, keeps recording, and reports the operation error", () => {
        const input = atom(0)
        const result = atom(0)
        const { store: target, inspect } = createInspectableStore()
        target.react(input, tx => {
            tx.set(result, 1)
            throw new Error("reaction failed")
        })

        inspect.reset()
        expect(() => target.set(input, 1)).toThrow(SubscriberNotificationError)
        target.set(result, 5)
        const report = inspect.export()

        expect(report.fault).toBeUndefined()
        const failed = commits(report).find(commit => commit.reaction === true)
        // The aborted draft never reached commit: no intents, nothing applied.
        expect(failed).toMatchObject({
            result: "threw",
            sourceApplied: false,
            intents: 0,
        })
        expect(operations(report).map(op => [op.result, op.effect])).toEqual([
            ["threw", "committed-with-notification-error"],
            ["returned", "committed"],
        ])
    })

    test("records a reaction commit triggered outside a Store operation", () => {
        let value = 0
        const listeners = new Set<() => void>()
        const source = externalAtom({
            getSnapshot: () => value,
            subscribe(invalidate) {
                listeners.add(invalidate)
                return () => void listeners.delete(invalidate)
            },
        })
        const mirrored = atom(0)
        const { store: target, inspect } = createInspectableStore()
        target.react(source, tx => tx.set(mirrored, tx.get(source)))

        inspect.reset()
        value = 3
        for (const invalidate of [...listeners]) invalidate()
        const report = inspect.export()

        expect(target.get(mirrored)).toBe(3)
        expect(operations(report)).toHaveLength(0)
        expect(commits(report)).toEqual([
            expect.objectContaining({
                reaction: true,
                operationId: 0,
                intents: 1,
                sourceApplied: true,
            }),
        ])
    })

    test("distinguishes a failed from a successful reaction without an operation", () => {
        const record = (fail: boolean) => {
            let value = 0
            let invalidate = () => {}
            const source = externalAtom({
                getSnapshot: () => value,
                subscribe(next) {
                    invalidate = next
                    return () => {}
                },
            })
            const { store: target, inspect } = createInspectableStore()
            target.react(source, () => {
                if (fail) throw new Error("reaction failed")
            })
            inspect.reset()
            value = 1
            let threw = false
            try {
                invalidate()
            } catch {
                threw = true
            }
            return { threw, commits: commits(inspect.export()) }
        }

        const succeeded = record(false)
        const failed = record(true)

        expect([succeeded.threw, failed.threw]).toEqual([false, true])
        expect(succeeded.commits).toEqual([
            expect.objectContaining({ reaction: true, result: "returned" }),
        ])
        expect(failed.commits).toEqual([
            expect.objectContaining({ reaction: true, result: "threw" }),
        ])
    })

    test("ordinary Stores acquire no recording and inspection never notifies", () => {
        const input = atom(0)
        const doubled = selector(get => get(input) * 2)
        const ordinary = store()
        const { store: inspected, inspect } = createInspectableStore()
        let notifications = 0
        inspected.sub(doubled, () => notifications++)
        inspected.react(input, () => undefined)
        ordinary.react(input, () => undefined)

        ordinary.set(input, 1)
        inspected.set(input, 1)
        inspect.export()
        inspect.reset()

        expect(notifications).toBe(1)
        expect("inspect" in ordinary).toBe(false)
    })
})
