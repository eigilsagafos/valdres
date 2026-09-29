import { describe, expect, test } from "bun:test"
import { atom, selector, store, type Selector } from "../../src/index"

const thrownBy = (operation: () => unknown): any => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

const GETTER = "VALDRES_SELECTOR_GETTER_ERROR"
const DEPENDENCY = "VALDRES_SELECTOR_DEPENDENCY_ERROR"

// JavaScriptCore keeps an Error's stack as a lazily computed own data property.
const lazyOwnStack =
    "value" in (Object.getOwnPropertyDescriptor(new Error(), "stack") ?? {})

const isWrapper = (value: unknown): value is Error & Record<string, unknown> =>
    value instanceof Error &&
    ((value as { code?: unknown }).code === GETTER ||
        (value as { code?: unknown }).code === DEPENDENCY)

const wrappersOf = (error: unknown): (Error & Record<string, unknown>)[] => {
    const chain: (Error & Record<string, unknown>)[] = []
    for (let cursor = error; isWrapper(cursor); cursor = cursor.cause) {
        chain.push(cursor)
    }
    return chain
}

describe("selector failure propagation wrappers", () => {
    test("keep immutable metadata and an exact cause chain to the untouched application error", () => {
        const fail = atom(true)
        const failure = new Error("root failure")
        const root = selector(
            get => {
                if (get(fail)) throw failure
                return 1
            },
            { name: "root" },
        )
        const middle = selector(get => get(root) + 1, { name: "middle" })
        const leaf = selector(get => get(middle) + 1, { name: "leaf" })
        const target = store()

        const error = thrownBy(() => target.get(leaf))
        const chain = wrappersOf(error)
        expect(chain.map(wrapper => wrapper.code)).toEqual([
            GETTER,
            DEPENDENCY,
            GETTER,
            DEPENDENCY,
            GETTER,
        ])
        expect(
            chain.map(wrapper => wrapper.selector ?? wrapper.dependency),
        ).toEqual([leaf, middle, middle, root, root])
        expect(chain.at(-1)!.cause).toBe(failure)

        for (const wrapper of chain) {
            const getter = wrapper.code === GETTER
            const name = getter
                ? "SelectorGetterError"
                : "SelectorDependencyError"
            const message = getter
                ? "Selector getter failed"
                : "Selector dependency failed"
            expect(wrapper.name).toBe(name)
            expect(wrapper.message).toBe(message)
            expect(Object.prototype.toString.call(wrapper)).toBe(
                "[object Error]",
            )
            expect(Object.isExtensible(wrapper)).toBe(false)
            const own = getter ? "selector" : "dependency"
            expect(
                Object.hasOwn(wrapper, getter ? "dependency" : "selector"),
            ).toBe(false)
            for (const key of ["message", "code", "name", own, "cause"]) {
                const descriptor = Object.getOwnPropertyDescriptor(wrapper, key)
                expect(descriptor).toMatchObject({
                    writable: false,
                    configurable: false,
                    enumerable: key !== "message",
                })
                expect(() => {
                    wrapper[key] = "replaced"
                }).toThrow(TypeError)
            }
            expect(() =>
                Object.defineProperty(wrapper, "extra", { value: true }),
            ).toThrow(TypeError)
            expect(
                String(wrapper.stack).startsWith(`${name}: ${message}`),
            ).toBe(true)
        }

        expect(Object.isFrozen(failure)).toBe(false)
        expect(Object.isExtensible(failure)).toBe(true)
        expect(failure.message).toBe("root failure")
        expect(thrownBy(() => target.get(leaf))).toBe(error)
        target.dispose()
    })

    test("carry arbitrary thrown values as the exact cause without inspecting them", () => {
        // The evaluator's thenable probe reads `then` once and its result
        // classification may check the prototype; wrapping must not touch
        // the thrown value beyond that.
        const touched: PropertyKey[] = []
        const hostile = new Proxy(
            {},
            {
                get: (_target, key) => {
                    touched.push(key)
                    return undefined
                },
                getPrototypeOf: () => {
                    touched.push("[[GetPrototypeOf]]")
                    return null
                },
                ownKeys: () => {
                    touched.push("[[OwnKeys]]")
                    return []
                },
                getOwnPropertyDescriptor: (_target, key) => {
                    touched.push(`[[GetOwnProperty]] ${String(key)}`)
                    return undefined
                },
            },
        )
        for (const thrown of [42, undefined, null, "text", hostile]) {
            const root = selector(() => {
                throw thrown
            })
            const reader = selector(get => get(root))
            const target = store()
            const error = thrownBy(() => target.get(reader))
            expect(error.code).toBe(GETTER)
            expect(error.cause.code).toBe(DEPENDENCY)
            expect(error.cause.dependency).toBe(root)
            expect(error.cause.cause.code).toBe(GETTER)
            expect(Object.is(error.cause.cause.cause, thrown)).toBe(true)
            expect(thrownBy(() => target.get(reader))).toBe(error)
            target.dispose()
        }
        expect(touched.filter(key => key !== "[[GetPrototypeOf]]")).toEqual([
            "then",
        ])
    })

    test("a catch-and-fallback reader receives the dependency wrapper, keeps the edge and recovers", () => {
        const fail = atom(false)
        const failure = new Error("root failure")
        const root = selector(get => {
            if (get(fail)) throw failure
            return 1
        })
        const caught: unknown[] = []
        const reader = selector(get => {
            try {
                return get(root) + 1
            } catch (error) {
                caught.push(error)
                return -1
            }
        })
        const target = store()
        let notifications = 0
        target.sub(reader, () => notifications++)
        expect(target.get(reader)).toBe(2)

        target.set(fail, true)
        expect(target.get(reader)).toBe(-1)
        expect(notifications).toBe(1)
        expect(caught).toHaveLength(1)
        const chain = wrappersOf(caught[0])
        expect(chain.map(wrapper => wrapper.code)).toEqual([DEPENDENCY, GETTER])
        expect(chain[0]!.dependency).toBe(root)
        expect(chain[1]!.cause).toBe(failure)

        target.set(fail, false)
        expect(target.get(reader)).toBe(2)
        expect(notifications).toBe(2)
        target.dispose()
    })

    test("fan-out, diamonds and chains publish coherent outcomes, notify once and recover", () => {
        const width = 8
        const layers = 6
        const tick = atom(0)
        const fail = atom(false)
        let evaluations = 0
        let rootThrows = 0
        const root = selector(get => {
            const value = get(tick)
            if (get(fail)) {
                rootThrows++
                throw new Error("root failure")
            }
            return value
        })
        const grid: Selector<number>[][] = []
        let previous: Selector<number>[] = [root]
        for (let layer = 0; layer < layers; layer++) {
            const row: Selector<number>[] = []
            for (let index = 0; index < width; index++) {
                const parents =
                    layer === 0
                        ? [root]
                        : index % 3 === 0
                          ? [previous[index >> 1]!]
                          : [previous[index]!, previous[(index + 1) % width]!]
                const catches = (layer * width + index) % 7 === 3
                row.push(
                    selector(get => {
                        evaluations++
                        let sum = 1
                        for (const parent of parents) {
                            if (!catches) {
                                sum += get(parent)
                                continue
                            }
                            try {
                                sum += get(parent)
                            } catch {
                                sum -= 1
                            }
                        }
                        return sum
                    }),
                )
            }
            grid.push(row)
            previous = row
        }
        const nodes = grid.flat()
        const target = store()
        let notifications = 0
        const unsubscribes = nodes.map(node =>
            target.sub(node, () => notifications++),
        )
        const outcomes = () =>
            nodes.map(node => {
                try {
                    return target.get(node)
                } catch (error) {
                    return error
                }
            })
        const healthy = outcomes()

        evaluations = 0
        target.set(fail, true)
        const failed = outcomes()
        expect(rootThrows).toBe(1)
        expect(evaluations).toBe(nodes.length)
        expect(notifications).toBe(nodes.length)
        const errors = failed.filter(isWrapper)
        expect(errors.length).toBeGreaterThan(0)
        expect(errors.length).toBeLessThan(nodes.length)
        for (const [index, outcome] of failed.entries()) {
            if (isWrapper(outcome)) {
                expect(outcome.code).toBe(GETTER)
                expect(outcome.selector).toBe(nodes[index])
                expect(wrappersOf(outcome).at(-1)!.cause).toBeInstanceOf(Error)
            } else {
                expect(typeof outcome).toBe("number")
            }
        }
        expect(outcomes()).toEqual(failed)
        for (const [index, outcome] of outcomes().entries()) {
            expect(outcome).toBe(failed[index])
        }

        // A persistent fault re-evaluates with fresh wrappers on a relevant
        // change; an equal write does nothing.
        notifications = 0
        target.set(tick, 1)
        const persistent = outcomes()
        expect(rootThrows).toBe(2)
        for (const [index, outcome] of persistent.entries()) {
            if (isWrapper(outcome)) expect(outcome).not.toBe(failed[index])
        }
        evaluations = 0
        const notified = notifications
        target.set(fail, true)
        expect(evaluations).toBe(0)
        expect(notifications).toBe(notified)

        target.set(tick, 0)
        target.set(fail, false)
        expect(outcomes()).toEqual(healthy)
        for (const unsubscribe of unsubscribes) unsubscribe()
        target.dispose()
    })

    test.if(lazyOwnStack)(
        "materialize no wrapper stack while propagating where the engine computes stacks lazily",
        () => {
            const fail = atom(false)
            const root = selector(get => {
                if (get(fail)) throw new Error("root failure")
                return 0
            })
            const chain: Selector<number>[] = []
            let previous: Selector<number> = root
            for (let index = 0; index < 50; index++) {
                const parent = previous
                previous = selector(get => get(parent) + 1)
                chain.push(previous)
            }
            const target = store()
            const unsubscribes = chain.map(node => target.sub(node, () => {}))
            const prepare = (Error as { prepareStackTrace?: unknown })
                .prepareStackTrace
            let materialized = 0
            ;(Error as { prepareStackTrace?: unknown }).prepareStackTrace = (
                error: unknown,
            ) => {
                if (isWrapper(error)) materialized++
                return `${error}`
            }
            try {
                target.set(fail, true)
                expect(materialized).toBe(0)
                const error = thrownBy(() => target.get(chain.at(-1)!))
                expect(materialized).toBe(0)
                expect(error.stack).toBe(
                    "SelectorGetterError: Selector getter failed",
                )
                expect(materialized).toBe(1)
            } finally {
                ;(Error as { prepareStackTrace?: unknown }).prepareStackTrace =
                    prepare
            }
            for (const unsubscribe of unsubscribes) unsubscribe()
            target.dispose()
        },
    )
})
