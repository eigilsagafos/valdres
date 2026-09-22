import { describe, expect, test } from "bun:test"
import {
    atom,
    collection,
    family,
    selector,
    store,
    type Selector,
} from "../../src/index"
import { deepEqual } from "../../src/equality"

describe("settlement after dependency reversal", () => {
    for (const directlyDirty of ["path", "output"] as const) {
        test(`resettles an already evaluated ${directlyDirty} after its upstream token changes`, () => {
            const flipped = atom(false)
            const inputA: Selector<number> = selector(get =>
                get(flipped) ? get(inputB) * 0.25 : 1,
            )
            const pathA = selector(get => {
                if (directlyDirty === "path") get(flipped)
                return get(inputA) * 0.5
            })
            let outputEvaluations = 0
            const outputA = selector(get => {
                outputEvaluations++
                const path = get(pathA)
                if (directlyDirty === "output") get(flipped)
                return path * 2
            })
            const inputB: Selector<number> = selector(get =>
                get(flipped) ? 1 : get(outputA),
            )
            const s = store()
            const seen: number[] = []
            const workDuringNotifications: number[] = []
            const stops = [
                s.sub(outputA, () => {
                    const before = outputEvaluations
                    seen.push(s.get(outputA))
                    workDuringNotifications.push(outputEvaluations - before)
                }),
                s.sub(inputB, () => {}),
            ]
            try {
                s.set(flipped, true)
                expect(seen).toEqual([0.25])
                expect(s.get(outputA)).toBe(0.25)
                s.set(flipped, false)
                expect(seen).toEqual([0.25, 1])
                expect(workDuringNotifications).toEqual([0, 0])
            } finally {
                stops.forEach(stop => stop())
                s.dispose()
            }
        })
    }

    for (const reverseSubscriptions of [false, true]) {
        for (const transaction of [false, true]) {
            for (const scoped of [false, true]) {
                test(`ordinary atom: reverse subscriptions=${reverseSubscriptions}, transaction=${transaction}, scoped=${scoped}`, () => {
                    const flipped = atom(false)
                    const evaluations = {
                        inputA: 0,
                        pathA: 0,
                        outputA: 0,
                        inputB: 0,
                    }
                    const inputA: Selector<number> = selector(get => {
                        evaluations.inputA++
                        return get(flipped) ? get(inputB) * 0.25 : 1
                    })
                    const pathA = selector(get => {
                        evaluations.pathA++
                        return get(inputA) * 0.5
                    })
                    const outputA = selector(get => {
                        evaluations.outputA++
                        return get(pathA) * 2
                    })
                    const inputB: Selector<number> = selector(get => {
                        evaluations.inputB++
                        return get(flipped) ? 1 : get(outputA)
                    })
                    const root = store()
                    const target = scoped ? root.scope() : root
                    const seen: number[] = []
                    let inputBNotifications = 0
                    const subscribe = [
                        () =>
                            target.sub(outputA, () =>
                                seen.push(target.get(outputA)),
                            ),
                        () =>
                            target.sub(inputB, () => {
                                inputBNotifications++
                            }),
                    ]
                    if (reverseSubscriptions) subscribe.reverse()
                    const stops = subscribe.map(sub => sub())
                    try {
                        if (transaction) root.txn(txn => txn.set(flipped, true))
                        else root.set(flipped, true)

                        // Check delivery and completed work BEFORE any reads can
                        // repair a stranded dirty record. inputB changed topology
                        // but kept its value, so its token must suppress delivery.
                        expect(seen).toEqual([0.25])
                        expect(inputBNotifications).toBe(0)
                        expect(evaluations).toEqual({
                            inputA: 2,
                            pathA: 2,
                            outputA: 2,
                            inputB: 2,
                        })
                        expect(target.get(outputA)).toBe(0.25)
                        expect(target.get(pathA)).toBe(0.125)
                        expect(target.get(inputA)).toBe(0.25)
                        expect(evaluations).toEqual({
                            inputA: 2,
                            pathA: 2,
                            outputA: 2,
                            inputB: 2,
                        })

                        root.set(flipped, false)
                        expect(seen).toEqual([0.25, 1])
                        expect(inputBNotifications).toBe(0)
                        root.set(flipped, true)
                        expect(seen).toEqual([0.25, 1, 0.25])
                        expect(inputBNotifications).toBe(0)
                    } finally {
                        stops.forEach(stop => stop())
                        root.dispose()
                    }
                })
            }
        }
    }

    test("equal topology changes retain tokens, then deliver settled final values", () => {
        const flipped = atom(false)
        const source = atom(1)
        const calls = { inputA: 0, pathA: 0, outputA: 0, inputB: 0 }
        const inputA: Selector<{ value: number }> = selector(
            get => {
                calls.inputA++
                return { value: get(flipped) ? get(inputB) : 1 }
            },
            { equal: (left, right) => left.value === right.value },
        )
        const pathA = selector(get => {
            calls.pathA++
            return get(inputA).value
        })
        const outputA = selector(get => {
            calls.outputA++
            return get(pathA)
        })
        const inputB: Selector<number> = selector(get => {
            calls.inputB++
            return get(flipped) ? get(source) : get(outputA)
        })
        const s = store()
        const snapshots: number[][] = []
        const observe = () => snapshots.push([s.get(outputA), s.get(inputB)])
        const stops = [s.sub(outputA, observe), s.sub(inputB, observe)]
        const before = s.get(inputA)
        try {
            s.set(flipped, true)
            expect(snapshots).toEqual([])
            expect(calls).toEqual({
                inputA: 2,
                pathA: 1,
                outputA: 1,
                inputB: 2,
            })
            expect(s.get(inputA)).toBe(before)

            s.set(source, 2)
            expect(snapshots).toEqual([
                [2, 2],
                [2, 2],
            ])
            expect(calls).toEqual({
                inputA: 3,
                pathA: 2,
                outputA: 2,
                inputB: 3,
            })
        } finally {
            stops.forEach(stop => stop())
            s.dispose()
        }
    })

    for (const reverseWrites of [false, true]) {
        test(`collection/family move: reverse writes=${reverseWrites}`, () => {
            type Entity = {
                parents: {
                    sequence?: string
                    predecessor?: string
                    decision?: string
                }
                children: { paths: string[] }
                data?: { probability: number }
            }
            const entity = collection<string, Entity>()
            const inputProbability = family(
                (ref: string): Selector<number> =>
                    selector(get => {
                        const e = get(entity(ref))!
                        if (e.parents.predecessor)
                            return get(outputProbability(e.parents.predecessor))
                        if (e.parents.sequence === "ROOT") return 1
                        return get(pathInput(e.parents.sequence!))
                    }),
            )
            const pathInput = family(
                (ref: string): Selector<number> =>
                    selector(get => {
                        const path = get(entity(ref))!
                        return (
                            get(inputProbability(path.parents.decision!)) *
                            path.data!.probability
                        )
                    }),
            )
            const joiningPaths = family((ref: string) =>
                selector(get => get(entity(ref))!.children.paths, {
                    equal: deepEqual,
                }),
            )
            const outputProbability = family(
                (ref: string): Selector<number> =>
                    selector(
                        get =>
                            get(joiningPaths(ref)).reduce(
                                (sum, path) => sum + get(pathInput(path)),
                                0,
                            ),
                        { equal: deepEqual },
                    ),
            )
            const s = store()
            s.set(entity("A"), {
                parents: { sequence: "ROOT" },
                children: { paths: ["A1", "A2"] },
            })
            s.set(entity("A1"), {
                parents: { decision: "A" },
                data: { probability: 0.5 },
                children: { paths: [] },
            })
            s.set(entity("A2"), {
                parents: { decision: "A" },
                data: { probability: 0.5 },
                children: { paths: [] },
            })
            s.set(entity("B"), {
                parents: { sequence: "ROOT", predecessor: "A" },
                children: { paths: ["B1"] },
            })
            s.set(entity("B1"), {
                parents: { decision: "B" },
                data: { probability: 0.25 },
                children: { paths: [] },
            })
            const seen = {
                outputA: [] as number[],
                inputA: [] as number[],
                outputB: [] as number[],
                inputB: [] as number[],
            }
            const stops = [
                s.sub(outputProbability("A"), () =>
                    seen.outputA.push(s.get(outputProbability("A"))),
                ),
                s.sub(inputProbability("A"), () =>
                    seen.inputA.push(s.get(inputProbability("A"))),
                ),
                s.sub(outputProbability("B"), () =>
                    seen.outputB.push(s.get(outputProbability("B"))),
                ),
                s.sub(inputProbability("B"), () =>
                    seen.inputB.push(s.get(inputProbability("B"))),
                ),
            ]
            try {
                s.txn(txn => {
                    const moves: [string, Entity][] = [
                        [
                            "A",
                            {
                                parents: { sequence: "B1" },
                                children: { paths: ["A1", "A2"] },
                            },
                        ],
                        [
                            "B",
                            {
                                parents: { sequence: "ROOT" },
                                children: { paths: ["B1"] },
                            },
                        ],
                    ]
                    if (reverseWrites) moves.reverse()
                    for (const [ref, next] of moves) txn.set(entity(ref), next)
                })
                expect(seen).toEqual({
                    outputA: [0.25],
                    inputA: [0.25],
                    outputB: [],
                    inputB: [],
                })
                expect(s.get(outputProbability("A"))).toBe(0.25)
                expect(s.get(inputProbability("A"))).toBe(0.25)
                expect(s.get(pathInput("A1"))).toBe(0.125)
                expect(s.get(pathInput("A2"))).toBe(0.125)
            } finally {
                stops.forEach(stop => stop())
                s.dispose()
            }
        })
    }
})
