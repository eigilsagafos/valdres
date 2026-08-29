import { describe, expect, test } from "bun:test"
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs"
import { dirname, extname, join, relative, resolve } from "node:path"
import {
    RuntimeMismatchError,
    createCommittedStoreTreeDomain,
    type CommittedStoreTree,
    type Selector,
} from "../../src/v1-internal/committed-store-tree/committed-store-tree"
import {
    SelectorCircularDependencyError,
    SelectorGetterError,
} from "../../src/v1-internal/selector-evaluator/errors"

const thrownBy = (operation: () => unknown): unknown => {
    try {
        operation()
    } catch (error) {
        return error
    }
    throw new Error("Expected operation to throw")
}

describe("v1 persistent committed StoreTree host", () => {
    test("stores exact Atom values with Object.is defaults and isolates StoreTrees", () => {
        const domain = createCommittedStoreTreeDomain()
        const count = domain.atom(0)
        const optional = domain.atom<undefined>(undefined)
        const fallbackHandler = (): string => "fallback"
        const handler = domain.atom(fallbackHandler)
        const nan = domain.atom(Number.NaN)
        const first = domain.createStoreTree()
        const second = domain.createStoreTree()
        const replacementHandler = (): string => "replacement"

        expect(Object.isFrozen(count)).toBe(true)
        expect(first.get(optional)).toBeUndefined()
        expect(Number.isNaN(first.get(nan))).toBe(true)
        expect(first.get(handler)).toBe(fallbackHandler)

        first.set(count, -0)
        first.set(handler, replacementHandler)

        expect(Object.is(first.get(count), -0)).toBe(true)
        expect(first.get(handler)).toBe(replacementHandler)
        expect(Object.is(second.get(count), 0)).toBe(true)
        expect(second.get(handler)).toBe(fallbackHandler)

        if (false) {
            // @ts-expect-error Atom values are invariant.
            first.set(count, "not a number")
        }
    })

    test("memoizes lazy value and error outcomes once per StoreTree and rejects thenables", () => {
        const domain = createCommittedStoreTreeDomain()
        let valueCalls = 0
        const lazy = domain.atomLazy(() =>
            Object.freeze({ invocation: ++valueCalls }),
        )
        const first = domain.createStoreTree()
        const second = domain.createStoreTree()

        const firstValue = first.get(lazy)
        expect(first.get(lazy)).toBe(firstValue)
        expect(second.get(lazy)).not.toBe(firstValue)
        expect(valueCalls).toBe(2)

        const cause = new Error("lazy failed")
        let errorCalls = 0
        const failed = domain.atomLazy(() => {
            errorCalls++
            throw cause
        })
        const firstError = thrownBy(() => first.get(failed))
        expect(thrownBy(() => first.get(failed))).toBe(firstError)
        expect(firstError).toBe(cause)
        expect(errorCalls).toBe(1)

        let thenGets = 0
        let thenCalls = 0
        const thenable = {
            get then() {
                thenGets++
                return (
                    _resolve: unknown,
                    reject: (error: unknown) => void,
                ): void => {
                    thenCalls++
                    reject(new Error("contained"))
                }
            },
        }
        const asynchronous = domain.atomLazy(() => thenable)
        const asynchronousError = thrownBy(() => first.get(asynchronous))
        expect(asynchronousError).toMatchObject({
            name: "InvalidSynchronousAtomValueError",
            code: "VALDRES_INVALID_SYNCHRONOUS_ATOM_VALUE",
        })
        expect(thrownBy(() => first.get(asynchronous))).toBe(asynchronousError)

        const thrownAsynchronous = domain.atomLazy(() => {
            throw thenable
        })
        expect(thrownBy(() => first.get(thrownAsynchronous))).toMatchObject({
            name: "InvalidSynchronousAtomValueError",
            code: "VALDRES_INVALID_SYNCHRONOUS_ATOM_VALUE",
        })

        expect(thrownBy(() => domain.atom(thenable))).toMatchObject({
            name: "InvalidSynchronousAtomValueError",
            code: "VALDRES_INVALID_SYNCHRONOUS_ATOM_VALUE",
        })

        const holder = domain.atom<unknown>(0)
        expect(thrownBy(() => first.set(holder, thenable))).toMatchObject({
            name: "InvalidSynchronousAtomValueError",
            code: "VALDRES_INVALID_SYNCHRONOUS_ATOM_VALUE",
        })
        expect(first.get(holder)).toBe(0)
        expect(thenGets).toBe(4)
        expect(thenCalls).toBe(4)
    })

    test("integrates the evaluator once per relevant committed token change", () => {
        const domain = createCommittedStoreTreeDomain()
        const source = domain.atom(1)
        const unrelated = domain.atom(0)
        let childEvaluations = 0
        let parentEvaluations = 0
        const child = domain.selector(get => {
            childEvaluations++
            return get(source) * 2
        })
        const parent = domain.selector(get => {
            parentEvaluations++
            return get(child) + 1
        })
        const tree = domain.createStoreTree()

        expect(tree.get(parent)).toBe(3)
        expect(tree.get(parent)).toBe(3)
        expect([childEvaluations, parentEvaluations]).toEqual([1, 1])

        tree.set(unrelated, 1)
        tree.set(source, 1)
        expect([childEvaluations, parentEvaluations]).toEqual([1, 1])

        tree.set(source, 2)
        expect(tree.get(parent)).toBe(5)
        expect([childEvaluations, parentEvaluations]).toEqual([2, 2])

        if (false) {
            // @ts-expect-error Selectors are not writable cells.
            tree.set(parent, 1)
        }
    })

    test("replaces dynamic reverse edges while equal selector values prune parents", () => {
        const domain = createCommittedStoreTreeDomain()
        const gate = domain.atom(true)
        const left = domain.atom(1)
        const right = domain.atom(1)
        let choiceEvaluations = 0
        let parentEvaluations = 0
        const choice = domain.selector(
            get => {
                choiceEvaluations++
                return Object.freeze({ value: get(get(gate) ? left : right) })
            },
            {
                equal: (previous, next) => previous.value === next.value,
            },
        )
        const parent = domain.selector(get => {
            parentEvaluations++
            return get(choice).value
        })
        const tree = domain.createStoreTree()

        expect(tree.get(parent)).toBe(1)
        tree.set(gate, false)
        expect([choiceEvaluations, parentEvaluations]).toEqual([2, 1])

        tree.set(left, 2)
        expect([choiceEvaluations, parentEvaluations]).toEqual([2, 1])

        tree.set(right, 2)
        expect(tree.get(parent)).toBe(2)
        expect([choiceEvaluations, parentEvaluations]).toEqual([3, 2])
    })

    test("publishes ordinary selector errors and recovers through retained routing", () => {
        const domain = createCommittedStoreTreeDomain()
        const fail = domain.atom(false)
        const cause = new Error("getter failed")
        let childEvaluations = 0
        let parentEvaluations = 0
        const child = domain.selector(get => {
            childEvaluations++
            if (get(fail)) throw cause
            return 3
        })
        const parent = domain.selector(get => {
            parentEvaluations++
            return get(child) + 1
        })
        const tree = domain.createStoreTree()

        expect(tree.get(parent)).toBe(4)
        expect(() => tree.set(fail, true)).not.toThrow()
        const firstError = thrownBy(() => tree.get(child))
        expect(firstError).toBeInstanceOf(SelectorGetterError)
        expect((firstError as SelectorGetterError).cause).toBe(cause)
        expect(thrownBy(() => tree.get(child))).toBe(firstError)
        expect(thrownBy(() => tree.get(parent))).toBeInstanceOf(
            SelectorGetterError,
        )

        tree.set(fail, false)
        expect(tree.get(parent)).toBe(4)
        expect([childEvaluations, parentEvaluations]).toEqual([3, 3])
    })

    test("keeps completed children when an active parent proposal fails", () => {
        const domain = createCommittedStoreTreeDomain()
        const leaf = domain.atom(2)
        let childEvaluations = 0
        const child = domain.selector(get => {
            childEvaluations++
            return get(leaf) * 2
        })
        const parent = domain.selector(get => {
            get(child)
            throw new Error("parent failed")
        })
        const tree = domain.createStoreTree()

        expect(thrownBy(() => tree.get(parent))).toBeInstanceOf(
            SelectorGetterError,
        )
        expect(tree.get(child)).toBe(4)
        expect(childEvaluations).toBe(1)
    })

    test("stores an acyclic attempted prefix and retries a dynamic cycle from it", () => {
        const domain = createCommittedStoreTreeDomain()
        const gate = domain.atom(false)
        let left!: Selector<number>
        let right!: Selector<number>
        left = domain.selector(get => (get(gate) ? get(right) : 1))
        right = domain.selector(get => get(left))
        const tree = domain.createStoreTree()

        expect(tree.get(right)).toBe(1)
        tree.set(gate, true)
        expect(thrownBy(() => tree.get(left))).toBeInstanceOf(
            SelectorCircularDependencyError,
        )

        tree.set(gate, false)
        expect(tree.get(right)).toBe(1)
    })

    test("rejects captured StoreTree operations without applying their work", () => {
        const domain = createCommittedStoreTreeDomain()
        const source = domain.atom(1)
        let tree!: CommittedStoreTree
        let caught: unknown
        const caughtMutation = domain.selector(get => {
            try {
                tree.set(source, 99)
            } catch (error) {
                caught = error
            }
            return get(source)
        })
        const uncaughtMutation = domain.selector(() => {
            tree.set(source, 100)
            return 0
        })
        tree = domain.createStoreTree()

        expect(tree.get(caughtMutation)).toBe(1)
        expect(caught).toMatchObject({
            name: "SelectorCapabilityError",
            code: "VALDRES_SELECTOR_CAPABILITY_ERROR",
        })
        expect(thrownBy(() => tree.get(uncaughtMutation))).toBeInstanceOf(
            SelectorGetterError,
        )
        expect(tree.get(source)).toBe(1)
    })

    test("keeps owner mismatches nonpublishing before apply and authoritative after apply", () => {
        const local = createCommittedStoreTreeDomain()
        const foreign = createCommittedStoreTreeDomain()
        let foreignInitializerCalls = 0
        const foreignAtom = foreign.atomLazy(() => {
            foreignInitializerCalls++
            return 7
        })
        const tree = local.createStoreTree()

        expect(thrownBy(() => tree.get(foreignAtom))).toBeInstanceOf(
            RuntimeMismatchError,
        )
        expect(foreignInitializerCalls).toBe(0)

        let includeForeign = true
        let preApplyEvaluations = 0
        const preApply = local.selector(() => {
            preApplyEvaluations++
            if (includeForeign) {
                try {
                    tree.get(foreignAtom)
                } catch {}
            }
            return 1
        })
        expect(thrownBy(() => tree.get(preApply))).toBeInstanceOf(
            RuntimeMismatchError,
        )
        includeForeign = false
        expect(tree.get(preApply)).toBe(1)
        expect(preApplyEvaluations).toBe(2)

        const trigger = local.atom(0)
        let contaminate = false
        let postApplyEvaluations = 0
        const postApply = local.selector(get => {
            postApplyEvaluations++
            const value = get(trigger)
            if (contaminate) {
                try {
                    tree.get(foreignAtom)
                } catch {}
            }
            return value
        })
        expect(tree.get(postApply)).toBe(0)

        contaminate = true
        const commitError = thrownBy(() => tree.set(trigger, 1))
        expect(commitError).toBeInstanceOf(RuntimeMismatchError)
        expect(tree.get(trigger)).toBe(1)
        expect(thrownBy(() => tree.get(postApply))).toBe(commitError)
        expect(postApplyEvaluations).toBe(2)

        contaminate = false
        tree.set(trigger, 2)
        expect(tree.get(postApply)).toBe(2)
        expect(postApplyEvaluations).toBe(3)
    })

    test("is absent from every current package export and entrypoint import graph", () => {
        const packageRoot = resolve(import.meta.dir, "../..")
        const manifest = JSON.parse(
            readFileSync(join(packageRoot, "package.json"), "utf8"),
        ) as { readonly exports: unknown }
        expect(JSON.stringify(manifest.exports)).not.toContain("v1-internal")

        const exportedSources = collectStrings(manifest.exports)
            .filter(path => path.endsWith(".ts") || path.endsWith(".tsx"))
            .map(path => resolve(packageRoot, path))
        expect(exportedSources).toHaveLength(2)
        const reachable = collectRuntimeSourceGraph(
            exportedSources,
            packageRoot,
        )
        expect(reachable.size).toBeGreaterThan(20)
        expect(
            [...reachable].filter(path => path.includes("/src/v1-internal/")),
        ).toEqual([])
    })
})

const collectStrings = (value: unknown): readonly string[] => {
    if (typeof value === "string") return [value]
    if (Array.isArray(value)) return value.flatMap(collectStrings)
    if (value === null || typeof value !== "object") return []
    return Object.values(value).flatMap(collectStrings)
}

const collectRuntimeSourceGraph = (
    entrypoints: readonly string[],
    packageRoot: string,
): ReadonlySet<string> => {
    const typeScriptTranspiler = new Bun.Transpiler({ loader: "ts" })
    const tsxTranspiler = new Bun.Transpiler({ loader: "tsx" })
    const pending = entrypoints.map(entrypoint => realpathSync(entrypoint))
    const visited = new Set<string>()

    while (pending.length > 0) {
        const path = pending.pop()!
        if (visited.has(path)) continue
        visited.add(path)
        const source = readFileSync(path, "utf8")
        const transpiler = path.endsWith(".tsx")
            ? tsxTranspiler
            : typeScriptTranspiler
        let imports: ReturnType<typeof transpiler.scanImports>
        try {
            imports = transpiler.scanImports(source)
        } catch (error) {
            throw new Error(`Failed to scan ${relative(packageRoot, path)}`, {
                cause: error,
            })
        }
        for (const imported of imports) {
            if (!imported.path.startsWith(".")) continue
            const resolved = resolveSourceImport(path, imported.path)
            if (resolved === undefined) continue
            const relativePath = relative(packageRoot, resolved)
            expect(relativePath.startsWith("..")).toBe(false)
            if (!visited.has(resolved)) pending.push(resolved)
        }
    }
    return visited
}

const resolveSourceImport = (
    importer: string,
    specifier: string,
): string | undefined => {
    const unresolved = resolve(dirname(importer), specifier)
    for (const candidate of [
        unresolved,
        `${unresolved}.ts`,
        `${unresolved}.tsx`,
        `${unresolved}.js`,
        join(unresolved, "index.ts"),
        join(unresolved, "index.tsx"),
    ]) {
        if (!existsSync(candidate) || !statSync(candidate).isFile()) continue
        if (![".ts", ".tsx", ".js"].includes(extname(candidate))) continue
        return realpathSync(candidate)
    }
    return undefined
}
