import { afterAll, beforeAll, describe, expect, spyOn, test } from "bun:test"
import { copyFile, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

type ValdresModule = typeof import("./fixtures/runtimeCopyEntry")

let temporaryDirectory: string
let knownVersionUrl: string
let otherVersionUrl: string
let unknownVersionUrl: string
const copyPaths = new Map<string, string>()

const buildRuntimeCopy = async (
    outputName: string,
    version: string | undefined,
): Promise<string> => {
    const result = await Bun.build({
        entrypoints: [join(import.meta.dir, "fixtures/runtimeCopyEntry.ts")],
        outdir: join(temporaryDirectory, outputName),
        target: "bun",
        define: {
            "process.env.VALDRES_VERSION":
                version === undefined ? "undefined" : JSON.stringify(version),
            __VALDRES_BUILD_VARIANT__: JSON.stringify("runtime-adoption-test"),
        },
    })
    if (!result.success) {
        throw new Error(result.logs.map(log => log.message).join("\n"))
    }
    const output = result.outputs.find(file => file.path.endsWith(".js"))
    if (!output) throw new Error("valdres test bundle did not emit JavaScript")
    return output.path
}

const importCopy = async (copy: string): Promise<ValdresModule> => {
    const copyPath = copyPaths.get(copy)
    if (!copyPath) throw new Error(`missing prepared runtime copy '${copy}'`)
    return import(pathToFileURL(copyPath).href)
}

const withoutLoadedRuntime = async (callback: () => Promise<void>) => {
    const previous = globalThis.__valdres__
    try {
        delete globalThis.__valdres__
        await callback()
    } finally {
        globalThis.__valdres__ = previous
    }
}

beforeAll(async () => {
    temporaryDirectory = await mkdtemp(join(tmpdir(), "valdres-runtime-"))
    ;[knownVersionUrl, otherVersionUrl, unknownVersionUrl] = await Promise.all([
        buildRuntimeCopy("known", "1.2.3-test"),
        buildRuntimeCopy("other", "2.0.0-test"),
        buildRuntimeCopy("unknown", undefined),
    ])
    const copies = [
        ["same-first", knownVersionUrl],
        ["same-second", knownVersionUrl],
        ["error-first", knownVersionUrl],
        ["error-second", knownVersionUrl],
        ["suspend-first", knownVersionUrl],
        ["suspend-second", knownVersionUrl],
        ["reset-first", knownVersionUrl],
        ["reset-second", knownVersionUrl],
        ["coordinator-first", knownVersionUrl],
        ["coordinator-second", knownVersionUrl],
        ["lifecycle-first", knownVersionUrl],
        ["lifecycle-second", knownVersionUrl],
        ["subscription-first", knownVersionUrl],
        ["subscription-second", knownVersionUrl],
        ["store-id-first", knownVersionUrl],
        ["store-id-second", knownVersionUrl],
        ["family-first", knownVersionUrl],
        ["family-second", knownVersionUrl],
        ["different-first", knownVersionUrl],
        ["different-second", otherVersionUrl],
        ["legacy-same-version", knownVersionUrl],
        ["unknown-first", unknownVersionUrl],
        ["unknown-second", unknownVersionUrl],
        ["mixed-unknown-first", unknownVersionUrl],
        ["mixed-known-second", knownVersionUrl],
        ["mixed-known-first", knownVersionUrl],
        ["mixed-unknown-second", unknownVersionUrl],
    ] as const
    await Promise.all(
        copies.map(async ([name, bundlePath]) => {
            const copyPath = join(temporaryDirectory, `${name}.js`)
            await copyFile(bundlePath, copyPath)
            copyPaths.set(name, copyPath)
        }),
    )
})

afterAll(async () => {
    await rm(temporaryDirectory, { recursive: true, force: true })
})

describe("multiple valdres copies", () => {
    test("same-version copies adopt one globalStore and share its state", async () => {
        await withoutLoadedRuntime(async () => {
            const first = await importCopy("same-first")
            const state = first.atom(0, { name: "runtime-adoption-atom" })
            first.globalStore.set(state, 42)

            const second = await importCopy("same-second")

            expect(second.globalStore).toBe(first.globalStore)
            expect(second.globalStore.get(state)).toBe(42)
            expect(second.dehydrate(second.globalStore).atoms).toEqual([
                ["runtime-adoption-atom", 42],
            ])
        })
    })

    test("exported errors remain catchable across adopted copies", async () => {
        await withoutLoadedRuntime(async () => {
            const first = await importCopy("error-first")
            const second = await importCopy("error-second")
            const crashing = second.selector(() => {
                throw new Error("boom")
            })

            let thrown: unknown
            try {
                first.globalStore.get(crashing)
            } catch (error) {
                thrown = error
            }

            expect(thrown).toBeInstanceOf(second.SelectorEvaluationError)

            const circular = new first.SelectorCircularDependencyError()
            expect(circular).toBeInstanceOf(
                second.SelectorCircularDependencyError,
            )
            expect(circular).toBeInstanceOf(second.SelectorEvaluationError)

            const schema = new first.SchemaValidationError(
                new Error("invalid"),
                first.atom(0),
            )
            expect(schema).toBeInstanceOf(second.SchemaValidationError)
            expect(new first.StoreDisposedError("cross-copy")).toBeInstanceOf(
                second.StoreDisposedError,
            )

            class FutureSelectorError extends first.SelectorEvaluationError {
                constructor() {
                    super()
                    this.name = "FutureSelectorError"
                }
            }
            expect(new FutureSelectorError()).toBeInstanceOf(
                second.SelectorEvaluationError,
            )
            expect(new first.SelectorEvaluationError()).not.toBeInstanceOf(
                FutureSelectorError,
            )
        })
    })

    test("internal suspension remains recognizable across adopted copies", async () => {
        await withoutLoadedRuntime(async () => {
            const first = await importCopy("suspend-first")
            const second = await importCopy("suspend-second")
            const suspension = new first.SuspendAndWaitForResolveError(
                Promise.resolve(),
            )

            expect(second.isSuspendError(suspension)).toBe(true)
            expect(suspension).toBeInstanceOf(
                second.SuspendAndWaitForResolveError,
            )
        })
    })

    test("an adopted copy can reset a live global atom", async () => {
        await withoutLoadedRuntime(async () => {
            const first = await importCopy("reset-first")
            const second = await importCopy("reset-second")
            const state = second.globalAtom(0, {
                name: "runtime-adoption-reset",
                onMount: () => () => {},
            })
            state.setSelf(1)
            const unsubscribe = first.globalStore.sub(state, () => {})

            try {
                expect(() => state.resetSelf()).not.toThrow()
                expect(first.globalStore.get(state)).toBe(0)
            } finally {
                unsubscribe()
            }
        })
    })

    test("adopted copies share async coordinators for shared StoreData", async () => {
        await withoutLoadedRuntime(async () => {
            const first = await importCopy("coordinator-first")
            const second = await importCopy("coordinator-second")
            const state = first.atom(0)
            const promise = Promise.resolve(1)
            const coordinator = { promise }

            first.setAsyncAtomCoordinatorEntry(
                state,
                first.globalStoreRuntime.data,
                coordinator,
            )

            expect(
                second.getAsyncAtomCoordinatorEntry(
                    state,
                    promise,
                    second.globalStoreRuntime.data,
                ),
            ).toBe(coordinator)
        })
    })

    test("adopted copies share StoreData lifecycle sentinels and tokens", async () => {
        await withoutLoadedRuntime(async () => {
            const first = await importCopy("lifecycle-first")
            const second = await importCopy("lifecycle-second")
            const data = first.createStoreData()
            const token = {}

            first.markStoreDisposed(data, token)
            expect(second.isStoreDisposed(data)).toBe(true)

            const error = second.createStoreDisposedError(data)
            expect(first.getStoreDisposedErrorToken(error)).toBe(token)
        })
    })

    test("adopted copies share subscription equality bookkeeping", async () => {
        await withoutLoadedRuntime(async () => {
            const first = await importCopy("subscription-first")
            const second = await importCopy("subscription-second")
            const data = first.createStoreData()
            const state = first.atom(0)
            const firstSubscription = {
                callback: () => {},
                requireDeepEqualCheckBeforeCallback: true,
            }
            const secondSubscription = {
                callback: () => {},
                requireDeepEqualCheckBeforeCallback: true,
            }
            const subscriptions = new Set([
                firstSubscription,
                secondSubscription,
            ])
            data.subscriptions.set(state, subscriptions)
            first.addSubscriptionEqualCheck(state, subscriptions, data)
            second.addSubscriptionEqualCheck(state, subscriptions, data)

            first.unsubscribe(state, firstSubscription, data)

            expect(data.subscriptionsRequireEqualCheck.get(state)).toBe(true)
        })
    })

    test("generated store ids stay unique across adopted copies", async () => {
        await withoutLoadedRuntime(async () => {
            const first = await importCopy("store-id-first")
            const second = await importCopy("store-id-second")

            expect(first.createStoreData().id).not.toBe(
                second.createStoreData().id,
            )
        })
    })

    test("same-version copies share the global atomFamily registry", async () => {
        await withoutLoadedRuntime(async () => {
            const first = await importCopy("family-first")
            const second = await importCopy("family-second")
            const firstFamily = first.globalAtomFamily<string, [string]>(
                key => `first:${key}`,
                { name: "runtime-adoption-family" },
            )
            const warn = spyOn(console, "warn").mockImplementation(() => {})
            try {
                const secondFamily = second.globalAtomFamily<string, [string]>(
                    key => `second:${key}`,
                    { name: "runtime-adoption-family" },
                )

                expect(secondFamily).toBe(firstFamily)
                expect(secondFamily("member").getSelf()).toBe("first:member")
                expect(warn).toHaveBeenCalledTimes(1)
            } finally {
                warn.mockRestore()
            }
        })
    })

    test("different known versions fail with deduplication guidance", async () => {
        await withoutLoadedRuntime(async () => {
            await importCopy("different-first")
            await expect(importCopy("different-second")).rejects.toThrow(
                /different valdres versions.*Loaded: 1\.2\.3-test.*Attempted: 2\.0\.0-test.*deduplicate/is,
            )
        })
    })

    test("a legacy same-version slot without a shared runtime cannot be adopted", async () => {
        const previous = globalThis.__valdres__
        try {
            globalThis.__valdres__ = "1.2.3-test"
            await expect(importCopy("legacy-same-version")).rejects.toThrow(
                /same-version instance.*does not expose the shared runtime.*deduplicate/is,
            )
        } finally {
            globalThis.__valdres__ = previous
        }
    })

    test("two unknown versions cannot be assumed compatible", async () => {
        await withoutLoadedRuntime(async () => {
            await importCopy("unknown-first")
            await expect(importCopy("unknown-second")).rejects.toThrow(
                /version is unknown.*Loaded: unknown.*Attempted: unknown.*VALDRES_VERSION/is,
            )
        })
    })

    test("a known version cannot adopt an unknown loaded runtime", async () => {
        await withoutLoadedRuntime(async () => {
            await importCopy("mixed-unknown-first")
            await expect(importCopy("mixed-known-second")).rejects.toThrow(
                /version is unknown.*Loaded: unknown.*Attempted: 1\.2\.3-test.*VALDRES_VERSION/is,
            )
        })
    })

    test("an unknown version cannot adopt a known loaded runtime", async () => {
        await withoutLoadedRuntime(async () => {
            await importCopy("mixed-known-first")
            await expect(importCopy("mixed-unknown-second")).rejects.toThrow(
                /version is unknown.*Loaded: 1\.2\.3-test.*Attempted: unknown.*VALDRES_VERSION/is,
            )
        })
    })
})
