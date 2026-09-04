import { expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
    atom,
    collection,
    family,
    selector,
    store,
    type Collection,
    type CollectionKey,
    type CollectionOptions,
    type CollectionRow,
    type CollectionValue,
    type State as PublicState,
} from "../../src/index"
import type { State as InternalState } from "../../src/v1-internal/committed-store-tree/types"

type Equal<Left, Right> =
    (<Value>() => Value extends Left ? 1 : 2) extends <
        Value,
    >() => Value extends Right ? 1 : 2
        ? true
        : false

const assertType = <Condition extends true>(): void => {}

interface Session {
    readonly id: string
    readonly active: boolean
}

interface SessionLookup {
    readonly tenant: string
    readonly id: string
}

test("exports invariant readonly collection arms through root State", () => {
    assertType<
        Equal<CollectionKey, string | number | bigint | boolean | null>
    >()
    assertType<
        Equal<
            CollectionValue,
            null | boolean | number | bigint | string | symbol | object
        >
    >()
    assertType<Equal<InternalState<number>, PublicState<number>>>()
    assertType<
        Equal<
            CollectionRow<string, Session> extends PublicState<
                Session | undefined
            >
                ? true
                : false,
            true
        >
    >()
    assertType<
        Equal<
            Collection<string, Session> extends PublicState<
                readonly CollectionRow<string, Session>[]
            >
                ? true
                : false,
            true
        >
    >()
    assertType<
        Equal<
            Collection<string, Session>,
            Collection<string, Session, string, never>
        >
    >()
    assertType<
        Equal<
            ReturnType<Collection<string, Session>>,
            CollectionRow<string, Session>
        >
    >()
    assertType<
        Equal<CollectionRow<string, Session>["kind"], "collection-row">
    >()
    assertType<Equal<Collection<string, Session>["kind"], "collection">>()
    assertType<Equal<undefined extends CollectionValue ? true : false, false>>()
    assertType<
        Equal<(() => void) extends CollectionValue ? true : false, true>
    >()
    assertType<
        Equal<
            CollectionRow<
                "literal",
                { readonly value: 1 }
            > extends CollectionRow<string, { readonly value: number }>
                ? true
                : false,
            false
        >
    >()

    const source = atom(1)
    const sessions = collection<string, Session>()
    const row = sessions("session")
    const target = store()
    const atomMembers = family((key: string) => atom(key.length))
    const selectorMembers = family((factor: number) =>
        selector(get => get(source) * factor),
    )

    expect(atomMembers("a").kind).toBe("atom")
    expect(selectorMembers(2).kind).toBe("selector")

    const rowState: PublicState<Session | undefined> = row
    const internalRowState: InternalState<Session | undefined> = row
    target.set(row, { id: "session", active: true })
    target.update(row, current => ({ ...current, active: false }))
    target.reset(row)
    target.delete(row)
    void [rowState, internalRowState]

    if (false) {
        const rows = undefined as unknown as Collection<string, Session>
        const fakeRow = {
            kind: "collection-row" as const,
            key: "session",
        }

        // @ts-expect-error family admission remains Atom-or-Selector.
        family(() => row)
        // @ts-expect-error family admission remains Atom-or-Selector.
        family(() => rows)
        // @ts-expect-error the private State marker rejects structural fakes.
        const structuralFake: CollectionRow<string, Session> = fakeRow
        // @ts-expect-error CollectionRow.kind is readonly.
        row.kind = "collection-row"
        // @ts-expect-error CollectionRow.key is readonly.
        row.key = "other"
        // @ts-expect-error Collection.kind is readonly.
        rows.kind = "collection"
        // @ts-expect-error `undefined` is reserved for row absence.
        const invalidValue: Collection<string, Session | undefined> = rows
        // @ts-expect-error undefined is the absence sentinel, not a row value.
        target.set(row, undefined)
        // @ts-expect-error row updaters cannot return the absence sentinel.
        target.update(row, () => undefined)
        // @ts-expect-error Atoms cannot be deleted.
        target.delete(source)
        // @ts-expect-error Collections are readonly membership States.
        target.set(rows, [])

        void [structuralFake, invalidValue]
    }
})

test("keeps direct options ergonomic and rich-input encoding mandatory", () => {
    const direct: CollectionOptions<string, Session> = {}
    const directEncoded: CollectionOptions<string, Session> = {
        encodeKey: input => input,
    }
    const rich: CollectionOptions<string, Session, SessionLookup> = {
        encodeKey: input => `${input.tenant}:${input.id}`,
    }

    expect(direct).toEqual({})
    expect(directEncoded.encodeKey?.("session")).toBe("session")
    expect(rich.encodeKey({ tenant: "north", id: "session" })).toBe(
        "north:session",
    )

    if (false) {
        // @ts-expect-error rich input requires an encoder.
        const missingEncoder: CollectionOptions<
            string,
            Session,
            SessionLookup
        > = {}
        const invalidEncoder: CollectionOptions<
            string,
            Session,
            SessionLookup
        > = {
            // @ts-expect-error encoders must return the canonical key type.
            encodeKey: input => input,
        }
        // @ts-expect-error indexes remain an intentionally closed coordinate.
        const indexed: CollectionOptions<string, Session> = { indexes: {} }
        // @ts-expect-error exact optional properties reject an explicit undefined index.
        const undefinedIndex: CollectionOptions<string, Session> = {
            indexes: undefined,
        }
        // @ts-expect-error direct canonical keys exclude symbols.
        const symbolKey: Collection<symbol, Session> = undefined as never
        // @ts-expect-error direct canonical keys exclude undefined.
        const undefinedKey: Collection<undefined, Session> = undefined as never

        void [
            missingEncoder,
            invalidEncoder,
            indexed,
            undefinedIndex,
            symbolKey,
            undefinedKey,
        ]
    }
})

test("emits nameable direct and rich-input collection declarations", async () => {
    const temporaryRoot = await mkdtemp(
        join(tmpdir(), "valdres-collection-types-"),
    )
    const packageDirectory = resolve(import.meta.dir, "../..")
    const tsc = resolve(packageDirectory, "../../node_modules/.bin/tsc")
    const libraryOut = join(temporaryRoot, "library")
    const consumerOut = join(temporaryRoot, "consumer-dist")

    try {
        const libraryResult = Bun.spawnSync(
            [
                tsc,
                "-p",
                join(packageDirectory, "tsconfig.json"),
                "--outDir",
                libraryOut,
            ],
            { cwd: packageDirectory, stdout: "pipe", stderr: "pipe" },
        )
        const libraryFailure = [
            libraryResult.stdout.toString(),
            libraryResult.stderr.toString(),
        ]
            .filter(Boolean)
            .join("\n")
        expect(libraryResult.exitCode, libraryFailure).toBe(0)

        const internalDeclarationPath = join(
            libraryOut,
            "v1-internal/committed-store-tree/types.d.ts",
        )
        const internalDeclaration = await readFile(
            internalDeclarationPath,
            "utf8",
        )
        expect(internalDeclaration).toContain(
            'ReadonlyState<Value, "collection-row">',
        )
        expect(internalDeclaration).toContain(
            'ReadonlyState<Value, "collection">',
        )
        expect(internalDeclaration).toContain("export interface Collection<")
        expect(internalDeclaration).toContain("export type CollectionOptions<")
        expect(internalDeclaration).not.toContain("export interface StateBase")
        expect(internalDeclaration).not.toContain(
            "export interface ReadonlyState",
        )

        await writeFile(
            join(temporaryRoot, "consumer.ts"),
            `import {
    collection,
    type Collection,
    type CollectionKey,
    type CollectionOptions,
    type CollectionValue,
} from "./library/index.js"

export interface Session {
    readonly id: string
    readonly active: boolean
}

export interface SessionLookup {
    readonly tenant: string
    readonly id: string
}

export const sessions = collection<string, Session>()
export const richSessions = collection<string, Session, SessionLookup>({
    encodeKey: input => \`${"${input.tenant}:${input.id}"}\`,
})
export const directOptions: CollectionOptions<string, Session> = {}
export const richOptions: CollectionOptions<string, Session, SessionLookup> = {
    encodeKey: input => \`${"${input.tenant}:${input.id}"}\`,
}
export const defineDirect = <
    Key extends CollectionKey,
    Value extends CollectionValue,
>() => collection<Key, Value>()
export const defineRich = <
    Key extends CollectionKey,
    Value extends CollectionValue,
    Input,
>(options: CollectionOptions<Key, Value, Input>) =>
    collection<Key, Value, Input>(options)
`,
        )
        await writeFile(
            join(temporaryRoot, "tsconfig.json"),
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

        const consumerResult = Bun.spawnSync(
            [tsc, "-p", join(temporaryRoot, "tsconfig.json")],
            { cwd: temporaryRoot, stdout: "pipe", stderr: "pipe" },
        )
        const consumerFailure = [
            consumerResult.stdout.toString(),
            consumerResult.stderr.toString(),
        ]
            .filter(Boolean)
            .join("\n")
        expect(consumerResult.exitCode, consumerFailure).toBe(0)

        const consumerDeclaration = await readFile(
            join(consumerOut, "consumer.d.ts"),
            "utf8",
        )
        expect(consumerDeclaration).toContain(
            'sessions: import("./library/v1.js").Collection<string, Session, string, never>',
        )
        expect(consumerDeclaration).toContain(
            'richSessions: import("./library/v1.js").Collection<string, Session, SessionLookup, never>',
        )
        expect(consumerDeclaration).toContain(
            "directOptions: CollectionOptions<string, Session>",
        )
        expect(consumerDeclaration).toContain(
            "richOptions: CollectionOptions<string, Session, SessionLookup>",
        )
        expect(consumerDeclaration).toContain(
            'defineDirect: <Key extends CollectionKey, Value extends CollectionValue>() => import("./library/v1.js").Collection<Key, Value, Key, never>',
        )
        expect(consumerDeclaration).toContain(
            'defineRich: <Key extends CollectionKey, Value extends CollectionValue, Input>(options: CollectionOptions<Key, Value, Input>) => import("./library/v1.js").Collection<Key, Value, Input, never>',
        )
        expect(consumerDeclaration).not.toContain("StateBase")
        expect(consumerDeclaration).not.toContain("ReadonlyState")
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true })
    }
})
