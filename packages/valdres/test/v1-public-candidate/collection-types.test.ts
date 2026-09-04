import { expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
    atom,
    family,
    selector,
    type State as PublicState,
} from "../../src/index"
import type {
    Atom,
    Collection,
    CollectionKey,
    CollectionOptions,
    CollectionRow,
    CollectionValue,
    Selector,
    State as InternalState,
} from "../../src/v1-internal/committed-store-tree/types"

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

test("stages invariant readonly collection arms without widening root State", () => {
    assertType<
        Equal<CollectionKey, string | number | bigint | boolean | null>
    >()
    assertType<
        Equal<
            CollectionValue,
            null | boolean | number | bigint | string | symbol | object
        >
    >()
    assertType<Equal<InternalState<number>, Atom<number> | Selector<number>>>()
    assertType<Equal<PublicState<number>, Atom<number> | Selector<number>>>()
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
    const atomMembers = family((key: string) => atom(key.length))
    const selectorMembers = family((factor: number) =>
        selector(get => get(source) * factor),
    )

    expect(atomMembers("a").kind).toBe("atom")
    expect(selectorMembers(2).kind).toBe("selector")

    if (false) {
        const row = undefined as unknown as CollectionRow<string, Session>
        const collection = undefined as unknown as Collection<string, Session>
        const fakeRow = {
            kind: "collection-row" as const,
            key: "session",
        }

        // @ts-expect-error readonly collection arms do not enter root State yet.
        const rowState: PublicState<Session | undefined> = row
        // @ts-expect-error readonly collection arms do not enter internal State yet.
        const internalRowState: InternalState<Session | undefined> = row
        // @ts-expect-error family admission remains Atom-or-Selector.
        family(() => row)
        // @ts-expect-error family admission remains Atom-or-Selector.
        family(() => collection)
        // @ts-expect-error the private State marker rejects structural fakes.
        const structuralFake: CollectionRow<string, Session> = fakeRow
        // @ts-expect-error CollectionRow.kind is readonly.
        row.kind = "collection-row"
        // @ts-expect-error CollectionRow.key is readonly.
        row.key = "other"
        // @ts-expect-error Collection.kind is readonly.
        collection.kind = "collection"
        // @ts-expect-error `undefined` is reserved for row absence.
        const invalidValue: Collection<string, Session | undefined> = collection

        void [rowState, internalRowState, structuralFake, invalidValue]
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
            "export type State<Value> = Atom<Value> | Selector<Value>;",
        )
        expect(internalDeclaration).toContain("export interface Collection<")
        expect(internalDeclaration).toContain("export type CollectionOptions<")
        expect(internalDeclaration).not.toContain("export interface StateBase")
        expect(internalDeclaration).not.toContain(
            "export interface ReadonlyState",
        )

        await writeFile(
            join(temporaryRoot, "consumer.ts"),
            `import type {
    Collection,
    CollectionKey,
    CollectionOptions,
    CollectionValue,
} from "./library/v1-internal/committed-store-tree/types.js"

declare function collection<
    Key extends CollectionKey,
    Value extends CollectionValue,
>(options?: CollectionOptions<Key, Value, Key>): Collection<Key, Value, Key>

declare function collection<
    Key extends CollectionKey,
    Value extends CollectionValue,
    Input,
>(options: CollectionOptions<Key, Value, Input>): Collection<Key, Value, Input>

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
            "sessions: Collection<string, Session, string, never>",
        )
        expect(consumerDeclaration).toContain(
            "richSessions: Collection<string, Session, SessionLookup, never>",
        )
        expect(consumerDeclaration).toContain(
            "directOptions: CollectionOptions<string, Session>",
        )
        expect(consumerDeclaration).toContain(
            "richOptions: CollectionOptions<string, Session, SessionLookup>",
        )
        expect(consumerDeclaration).not.toContain("StateBase")
        expect(consumerDeclaration).not.toContain("ReadonlyState")
    } finally {
        await rm(temporaryRoot, { recursive: true, force: true })
    }
})
