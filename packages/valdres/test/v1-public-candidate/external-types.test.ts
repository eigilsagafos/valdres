import { expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
    externalAtom,
    family,
    selector,
    store,
    type Atom,
    type ExternalAtom,
    type ExternalAtomOptions,
    type ExternalSource,
    type GetValue,
    type State,
    type Transaction,
} from "../../src/index"
// @ts-expect-error internal lifecycle bounds are not a root API type.
import type { ExternalBounds } from "../../src/index"
// @ts-expect-error internal phase types are not a root API type.
import type { ExternalOperationPhase } from "../../src/index"
// @ts-expect-error internal operation ledgers are not a root API type.
import type { ExternalOperationFailure } from "../../src/index"
// @ts-expect-error projection runtime types are not a root API type.
import type { ExternalTreePlane } from "../../src/index"

type Equal<Left, Right> =
    (<Value>() => Value extends Left ? 1 : 2) extends <
        Value,
    >() => Value extends Right ? 1 : 2
        ? true
        : false
const assertType = <Condition extends true>(): void => {}

test("exports an invariant readonly State arm with named structural source and options types", () => {
    assertType<Equal<ExternalAtom<number>["kind"], "external">>()
    assertType<
        Equal<ExternalAtom<number> extends State<number> ? true : false, true>
    >()
    assertType<
        Equal<
            ExternalAtom<1> extends ExternalAtom<number> ? true : false,
            false
        >
    >()
    assertType<
        Equal<
            ExternalAtom<number> extends ExternalAtom<1> ? true : false,
            false
        >
    >()
    assertType<
        Equal<ExternalAtom<number> extends Atom<number> ? true : false, false>
    >()
    assertType<Equal<keyof ExternalAtomOptions, "name">>()
    assertType<
        Equal<
            keyof ExternalSource<number>,
            "getSnapshot" | "getServerSnapshot" | "subscribe"
        >
    >()
    const source: ExternalSource<number> = {
        getSnapshot: () => 1,
        getServerSnapshot: () => 1,
        subscribe: () => () => {},
    }
    const options: ExternalAtomOptions = { name: "external number" }
    const external = externalAtom(source, options)
    const state: State<number> = external
    const target = store()
    const read: GetValue = target.get
    const derived = selector(get => get(external) * 2)
    const members = family((key: string) =>
        externalAtom({ ...source, getSnapshot: () => key.length }),
    )
    const member: ExternalAtom<number> = members("member")
    const result: number = read(state)
    expect(result).toBe(1)
    expect(target.get(derived)).toBe(2)
    expect(target.get(member)).toBe(6)
    const captured: number = target.txn(transaction =>
        transaction.get(external),
    )
    expect(captured).toBe(1)
    target.dispose()

    if (false) {
        const transaction = undefined as unknown as Transaction
        const narrow = undefined as unknown as ExternalAtom<1>
        // @ts-expect-error ExternalAtom is invariant in its value.
        const widened: ExternalAtom<number> = narrow
        // @ts-expect-error readonly States cannot be set.
        target.set(external, 2)
        // @ts-expect-error readonly States cannot be updated.
        target.update(external, () => 2)
        // @ts-expect-error readonly States cannot be reset.
        target.reset(external)
        // @ts-expect-error readonly States cannot be set in a transaction.
        transaction.set(external, 2)
        // @ts-expect-error readonly States cannot be updated in a transaction.
        transaction.update(external, () => 2)
        // @ts-expect-error readonly States cannot be reset in a transaction.
        transaction.reset(external)
        // @ts-expect-error ExternalAtom.kind is readonly.
        external.kind = "external"
        // @ts-expect-error structural fakes cannot forge the invariant brand.
        const forged: ExternalAtom<number> = { kind: "external" }
        // @ts-expect-error name is the only supported option.
        externalAtom(source, { equal: Object.is })
        // @ts-expect-error source lifecycle is not an ExternalAtom option.
        externalAtom(source, { subscribe: () => () => {} })
        // @ts-expect-error unknown symbol keys are not supported.
        externalAtom(source, { [Symbol.iterator]: () => [] })
        // @ts-expect-error exact optional types reject an explicit undefined name.
        externalAtom(source, { name: undefined })
        // @ts-expect-error ExternalSource members are readonly.
        source.getSnapshot = () => 2
        // @ts-expect-error options are readonly.
        options.name = "changed"
        void [widened, forged]
    }
})

test("emits nameable ExternalAtom declarations without exporting internal lifecycle types", async () => {
    const directory = await mkdtemp(join(tmpdir(), "valdres-external-types-"))
    const packageDirectory = resolve(import.meta.dir, "../..")
    const tsc = resolve(packageDirectory, "../../node_modules/.bin/tsc")
    const run = (args: string[], cwd: string) => {
        const result = Bun.spawnSync([tsc, ...args], {
            cwd,
            stdout: "pipe",
            stderr: "pipe",
        })
        expect(
            result.exitCode,
            result.stdout.toString() + result.stderr.toString(),
        ).toBe(0)
    }
    try {
        run(
            [
                "-p",
                join(packageDirectory, "tsconfig.json"),
                "--outDir",
                join(directory, "library"),
            ],
            packageDirectory,
        )
        const declaration = await readFile(
            join(directory, "library/index.d.ts"),
            "utf8",
        )
        for (const name of [
            "ExternalAtom",
            "ExternalSource",
            "ExternalAtomOptions",
        ]) {
            expect(declaration).toContain(`export type ${name}`)
        }
        for (const name of [
            "ExternalBounds",
            "ExternalOperationFailure",
            "ExternalOperationPhase",
            "ExternalTreePlane",
            "ExternalTreeBindings",
            "ExternalTreeHost",
        ]) {
            expect(declaration).not.toContain(`export type ${name}`)
            expect(declaration).not.toContain(`export interface ${name}`)
        }
        await writeFile(
            join(directory, "consumer.ts"),
            `import {
    externalAtom, family, selector, store,
    type ExternalAtom, type ExternalSource, type ExternalAtomOptions,
} from "./library/index.js"

export interface Snapshot { readonly label: string }
export const source: ExternalSource<Snapshot> = {
    getSnapshot: () => ({ label: "live" }),
    getServerSnapshot: () => ({ label: "server" }),
    subscribe: () => () => {},
}
export const options: ExternalAtomOptions = { name: "snapshot" }
export const snapshot = externalAtom(source, options)
export const members = family((key: string) => externalAtom({
    getSnapshot: () => key.length,
    subscribe: () => () => {},
}))
export const member = members("member")
export const label = selector(get => get(snapshot).label)
export const value = store().get(snapshot)
export const define = <Value>(input: ExternalSource<Value>): ExternalAtom<Value> => externalAtom(input)
`,
        )
        await writeFile(
            join(directory, "tsconfig.json"),
            JSON.stringify({
                compilerOptions: {
                    declaration: true,
                    emitDeclarationOnly: true,
                    exactOptionalPropertyTypes: true,
                    module: "ESNext",
                    moduleResolution: "Bundler",
                    outDir: "./consumer-dist",
                    skipLibCheck: false,
                    strict: true,
                    target: "ESNext",
                },
                include: ["./consumer.ts"],
            }),
        )
        run(["-p", join(directory, "tsconfig.json")], directory)
        const consumer = await readFile(
            join(directory, "consumer-dist/consumer.d.ts"),
            "utf8",
        )
        expect(consumer).toContain("snapshot: ExternalAtom<Snapshot>")
        expect(consumer).toContain("member: ExternalAtom<number>")
        expect(consumer).toContain("options: ExternalAtomOptions")
        expect(consumer).toContain("source: ExternalSource<Snapshot>")
        expect(consumer).toContain("value: Snapshot")
        expect(consumer).toContain(
            "define: <Value>(input: ExternalSource<Value>) => ExternalAtom<Value>",
        )
        expect(consumer).not.toContain("v1-internal")
        expect(consumer).not.toContain("privateStateValue")
    } finally {
        await rm(directory, { recursive: true, force: true })
    }
})
