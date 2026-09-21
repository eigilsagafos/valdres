import { createInternalExternalAtom } from "../../src/v1-internal/committed-store-tree/external-atom"
import { expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import { createCommittedStoreTreeDomain } from "../../src/v1-internal/committed-store-tree/committed-store-tree"

function retentionTest(name: string, check: () => Promise<void>): void {
    test(name, async () => {
        if (process.env.VALDRES_EXTERNAL_RETENTION_CHILD === "1") {
            await check()
            console.log(`EXTERNAL_RETENTION_PASS:${name}`)
            return
        }
        // Unrelated suites can leave conservative JSC roots after their frames
        // return. Each fresh process checks the same live and released ownership.
        const child = spawnSync(
            process.execPath,
            ["test", import.meta.path, "--test-name-pattern", `^${name}$`],
            {
                env: { ...process.env, VALDRES_EXTERNAL_RETENTION_CHILD: "1" },
                timeout: 5_000,
                encoding: "utf8",
            },
        )
        expect(child.status, child.error?.message ?? child.stderr).toBe(0)
        expect(child.stdout.split("\n")).toContain(
            `EXTERNAL_RETENTION_PASS:${name}`,
        )
    })
}

async function collected(
    references: readonly WeakRef<object>[],
): Promise<number> {
    let retained = references.length
    for (let round = 0; round < 20 && retained !== 0; round++) {
        // WeakRef.deref keeps its target alive until the next task; Bun.sleep(0)
        // only yields to microtasks, so each retry needs an actual timer turn.
        await new Promise<void>(resolve => setTimeout(resolve, 0))
        Bun.gc(true)
        retained = references.filter(
            reference => reference.deref() !== undefined,
        ).length
    }
    return retained
}

retentionTest(
    "a dormant projection and reverse routes do not retain abandoned definitions or scopes",
    async () => {
        const domain = createCommittedStoreTreeDomain(),
            tree = domain.createStoreTree()
        const references = (() => {
            const source = { getSnapshot: () => 1, subscribe: () => () => {} }
            const ext = createInternalExternalAtom(domain, source)
            const selector = domain.selector(get => get(ext))
            const child = tree.scope()
            expect(child.get(selector)).toBe(1)
            return [source, ext, selector, child].map(
                value => new WeakRef(value),
            )
        })()
        await collected(references)
        expect(
            references.map(reference => reference.deref() !== undefined),
        ).toEqual([false, false, false, false])
        tree.dispose()
    },
)

retentionTest(
    "stale invalidators and unsubscribe handles retain no departed tree or application objects",
    async () => {
        let stale!: () => void,
            stop!: () => void,
            cleanups = 0
        const references = (() => {
            const domain = createCommittedStoreTreeDomain(),
                tree = domain.createStoreTree(),
                child = tree.scope()
            const source = {
                getSnapshot: () => 1,
                subscribe(fn: () => void) {
                    stale = fn
                    return () => {
                        cleanups++
                    }
                },
            }
            const ext = createInternalExternalAtom(domain, source)
            const selector = domain.selector(get => get(ext))
            const callback = () => {}
            stop = child.sub(selector, callback)
            return [tree, child, source, ext, selector, callback].map(
                value => new WeakRef(value),
            )
        })()
        for (let index = 0; index < 3; index++) {
            await Bun.sleep(0)
            Bun.gc(true)
        }
        expect(
            references.every(reference => reference.deref() !== undefined),
        ).toBe(true)
        stop()
        expect(cleanups).toBe(1)
        expect(await collected(references)).toBe(0)
        stale()
        stop()
        expect(cleanups).toBe(1)
    },
)

retentionTest(
    "disposal severs active ownership even when a source keeps old callbacks forever",
    async () => {
        const old: (() => void)[] = []
        let cleanups = 0
        const source = {
            getSnapshot: () => 1,
            subscribe(fn: () => void) {
                old.push(fn)
                return () => {
                    cleanups++
                }
            },
        }
        const references = (() => {
            const domain = createCommittedStoreTreeDomain(),
                tree = domain.createStoreTree()
            const ext = createInternalExternalAtom(domain, source)
            const callback = () => {}
            tree.sub(ext, callback)
            tree.dispose()
            return [tree, ext, callback].map(value => new WeakRef(value))
        })()
        expect(cleanups).toBe(1)
        expect(await collected(references)).toBe(0)
        for (const callback of old) callback()
        expect(cleanups).toBe(1)
    },
)
