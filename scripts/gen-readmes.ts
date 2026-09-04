/**
 * Generates a README.md for every publishable package from its co-located docs
 * MDX (plugins) or a short template (core / adapters / react bindings).
 *
 *   bun run scripts/gen-readmes.ts          # write READMEs
 *   bun run scripts/gen-readmes.ts --check  # fail if any README is out of date (CI)
 *
 * Generated content lives between <!-- DOCS:START --> / <!-- DOCS:END -->, so any
 * prose a maintainer adds outside the markers is preserved. A README that has
 * substantial hand-written content but no markers is left untouched.
 *
 * No `files`-field change is needed: npm always includes a package's root
 * README.md in the tarball regardless of the `files` allowlist.
 */
import { discoverPackages, type PackageInfo } from "./lib/readme-sources"
import { mdxToMarkdown } from "./lib/mdx-to-markdown"

const ROOT = `${import.meta.dir}/..`
const START = "<!-- DOCS:START -->"
const END = "<!-- DOCS:END -->"

function installSnippet(pkg: PackageInfo): string {
    const parts = [pkg.name, ...pkg.peerDeps.filter(p => p !== pkg.name)]
    return ["```bash", `npm install ${parts.join(" ")}`, "```"].join("\n")
}

const CORE_EXAMPLE = [
    "```ts",
    'import { store, atom, selector } from "valdres"',
    "",
    "const countAtom = atom(0)",
    "const doubledSelector = selector(get => get(countAtom) * 2)",
    "",
    "const s = store()",
    "s.set(countAtom, 21)",
    "s.get(doubledSelector) // 42",
    "```",
].join("\n")

const V1_CORE_BODY = [
    "# valdres",
    "",
    "The first public beta of Valdres's new synchronous state engine.",
    "",
    "## Installation",
    "",
    "```bash",
    "npm install valdres@beta",
    "```",
    "",
    CORE_EXAMPLE,
    "",
    "`set` always stores the exact value you pass, including functions. Use `update` when the next value depends on the current value:",
    "",
    "```ts",
    "s.set(countAtom, 1)",
    "s.update(countAtom, current => current + 1)",
    "```",
    "",
    "A store also exposes `sub`, `reset`, `txn`, `scope`, and `dispose`. Store operations are stable bound functions, so they can be passed as callbacks without rebinding. `store.txn(callback, name?)` accepts an optional human-readable diagnostic label; labels are metadata, not identity.",
    "",
    "`atom(initial, options)` and `atom.lazy(initialize, options)` create writable state. `selector(read, options)` creates synchronous derived state. Atom and selector options accept an inert diagnostic `name` and an `equal(previous, next)` comparator.",
    "",
    "## Parameterized State identity",
    "",
    "`family(factory)` memoizes one Atom or Selector per non-empty ordered tuple of primitive keys (`string`, `number`, `bigint`, `boolean`, `symbol`, `null`, or `undefined`). Keys use SameValueZero, so `NaN` matches `NaN` and `0` matches `-0`; tuple arity and order still matter.",
    "",
    "```ts",
    'import { atom, family } from "valdres"',
    "",
    'const cellValue = family((sheetId: string, row: number) => atom(""))',
    'cellValue("budget", 4) === cellValue("budget", 4) // true',
    "",
    "type Step = { readonly id: string; readonly title: string }",
    "",
    "const stepProgress = family((step: Step) => atom(0), {",
    "    encodeKey: step => step.id,",
    "})",
    "",
    'stepProgress({ id: "step-1", title: "Draft" }) ===',
    '    stepProgress({ id: "step-1", title: "Review" }) // true',
    "```",
    "",
    "Structured arguments require a synchronous `encodeKey` that returns one canonical primitive key. The factory must construct and return its Atom or Selector during that member's construction, or return any member already published by a family. Returning an arbitrary pre-existing State is rejected.",
    "",
    "The exported `FamilyKey` type names the primitive-key union for reusable APIs.",
    "",
    "Factories and encoders are synchronous definition callbacks, not Store work. Neither may perform Store, scope, transaction, or subscription operations or borrow an active selector's `get`. Encoders also cannot construct State definitions or call a family; factories may do both. A violation throws without caching a member.",
    "",
    "The family cache is weak. A live reference, a committed Store override for a family Atom, an active subscription, or a retained selector dependency keeps that member alive. Reset or disposal releases Store ownership, and unsubscription releases subscription ownership. After the last owner disappears, a later lookup may run the factory again.",
    "",
    "A family is only a callable identity cache. It has no membership or enumeration API and no `delete`, `release`, `index`, Store, or collection surface.",
    "",
    "## Keyed collections",
    "",
    "`collection()` defines canonical keyed rows and a readonly ordered membership State. Store and Transaction `set`, `update`, `reset`, and `delete` mutate rows; `presence(row)` is a readonly Selector. Reads never insert.",
    "",
    "## Opt-in structural equality",
    "",
    "`Object.is` remains the default comparator. Import `deepEqual` from the separate equality entry only where structurally equal replacements should retain the previous reference and stop notifications or downstream propagation:",
    "",
    "```ts",
    'import { atom } from "valdres"',
    'import { deepEqual } from "valdres/equality"',
    "",
    "const documentAtom = atom({ blocks: [] }, { equal: deepEqual })",
    "```",
    "",
    "`deepEqual` recursively compares supported values using SameValueZero primitive leaves, own enumerable string and symbol properties, and native identity for Map keys and Set members. Non-binary objects require the same prototype. Matching binary brands compare visible bytes across realms and ignore attached properties. Functions, Promises, Errors, URLs, weak collections, other opaque platform objects, and DOM nodes compare only by identity. Cyclic structures are unsupported. Reached getters, Proxy traps, `valueOf`, and `toString` hooks can run and throw.",
    "",
    "Structural comparison walks the compared values, so use it deliberately on allocation-heavy results where pruning redundant updates outweighs that work. The separate `valdres/equality` entry keeps it out of ordinary root bundles.",
    "",
    "## Inspect a Store",
    "",
    "`valdres/inspect` creates an opt-in Store with a bounded structural flight recorder. It belongs to the same runtime domain as ordinary Stores, so existing atoms, selectors, scopes, and framework adapters work unchanged:",
    "",
    "```ts",
    'import { createInspectableStore } from "valdres/inspect"',
    "",
    "const { store: appStore, inspect } = createInspectableStore()",
    "",
    'inspect.span("drop interaction", () =>',
    "    appStore.txn(transaction => {",
    "        transaction.update(processAtom, updateProcess)",
    '    }, "collapse process"),',
    ")",
    "",
    "const report = inspect.export()",
    "inspect.reset()",
    "```",
    "",
    "The report links labels to opaque operation, commit, evaluation, session, and search IDs. It records selector topology/search work, collection row and membership work, related counters, and propagation/notification totals. Summary/detail rings are bounded with explicit overflow. Exports are immutable and JSON-safe; collection keys, values, callbacks, errors, and live State handles are never recorded. Labels are metadata, not identity. The core inspection schema is version 6.",
    "",
    "Inspection adds recording and timing work only to the Store created by `createInspectableStore`. The recorder stays outside the ordinary root entry and ordinary consumer bundles remain within their existing size budget.",
    "",
    "The versioned `valdres/adapter-internals/v1` entry is for framework bindings. It exports only `assertStore`, `read`, `subscribe`, and `readHydrationSnapshot`; application code should use Store methods directly.",
    "",
    "## Beta compatibility",
    "",
    "`valdres@1.0.0-beta.24` and later v1 betas intentionally replace the legacy beta API. `valdres-react@1.0.0-beta.6` is certified with `valdres@1.0.0-beta.27` and later v1 betas accepted by its `^1.0.0-beta.27` peer range. Deferred framework adapters and plugins remain unsupported even when their published semver ranges allow npm to resolve this core; do not mix them with the new beta until they are migrated.",
].join("\n")

const V1_REACT_BODY = [
    "# valdres-react",
    "",
    "React 18 and 19 bindings for the Valdres v1 beta.",
    "",
    "## Installation",
    "",
    "```bash",
    "npm install valdres@beta valdres-react@beta react",
    "```",
    "",
    "```tsx",
    'import { atom, store } from "valdres"',
    'import { Provider, useUpdateAtom, useValue } from "valdres-react"',
    "",
    "const appStore = store()",
    "const count = atom(0)",
    "",
    "function Counter() {",
    "    const value = useValue(count)",
    "    const increment = useUpdateAtom(count)",
    "    return <button onClick={() => increment(current => current + 1)}>{value}</button>",
    "}",
    "",
    "export function App() {",
    "    return (",
    "        <Provider store={appStore}>",
    "            <Counter />",
    "        </Provider>",
    "    )",
    "}",
    "```",
    "",
    "The public hooks are `useStore`, `useValue`, `useAtom`, `useSetAtom`, `useUpdateAtom`, and `useResetAtom`. State hooks may also receive an explicit Store as their second argument. Provider borrows the Store you pass; it never creates, initializes, or disposes it.",
    "",
    "## Opt-in React correlation",
    "",
    "`valdres-react/inspect` binds the React adapter to a Store created by `valdres/inspect`. Use the returned Provider and hooks only for the tree being measured:",
    "",
    "```tsx",
    'import { createInspectableStore } from "valdres/inspect"',
    'import { createInspectableReact } from "valdres-react/inspect"',
    "",
    "const core = createInspectableStore()",
    "const react = createInspectableReact(core)",
    'const editorStore = core.store.scope("editor")',
    "",
    "function Editor() {",
    "    const document = react.useValue(documentAtom)",
    "    return <DocumentView document={document} />",
    "}",
    "",
    "export function InspectedEditor() {",
    "    return (",
    "        <react.Provider store={editorStore}>",
    "            <Editor />",
    "        </react.Provider>",
    "    )",
    "}",
    "",
    "const report = react.inspect.export()",
    "react.inspect.reset()",
    "```",
    "",
    "Omit the Provider's `store` prop to use the inspected root Store, or pass a child scope owned by the same inspector. The returned state and writer hooks also retain their optional explicit Store overrides and reject Stores outside that inspector.",
    "",
    "The immutable composite export contains the exact core flight-recorder report plus separately bounded React timelines. Subscriber rows retain the genuinely active core IDs read through the recording-neutral `core.inspect.capture(store, state?)` seam. Snapshot rows distinguish React's synchronous subscriber check from later reads; they are reads, not component render counts. Profiler rows are boundary callbacks on the same clock, while their `commitTimeGroupId` is only a timestamp grouping key—not a unique commit or a causal link to a Store operation.",
    "",
    "Subscriber and snapshot timelines work in ordinary production React builds. Profiler timing is available only in development or a profiling-enabled production build. The recording/export retains no State values, props, children, callbacks, errors, or component instances. The opt-in entry is absent from the ordinary `valdres-react` root bundle and adds no capture work to ordinary hooks.",
    "",
    "## Beta compatibility",
    "",
    "Use `useSetAtom` for exact values and `useUpdateAtom` for updater functions. The legacy `Scope`, `useStoreId`, `useTransaction`, `useValdresCallback`, and optional-store Provider APIs are not part of this beta.",
    "",
    "`valdres-react@1.0.0-beta.6` is certified with `valdres@1.0.0-beta.27` and later v1 betas accepted by its `^1.0.0-beta.27` peer range. Deferred adapters and plugins remain unsupported even when their published semver ranges allow npm to resolve this core or React package; do not mix them with the new beta until they are migrated.",
].join("\n")

function indexBody(pkg: PackageInfo): string {
    if (pkg.name === "valdres") return V1_CORE_BODY
    if (pkg.name === "valdres-react") return V1_REACT_BODY

    const lines = [`# ${pkg.name}`, ""]
    if (pkg.description) lines.push(pkg.description, "")
    lines.push("## Installation", "", installSnippet(pkg), "")
    if (pkg.name === "valdres") lines.push(CORE_EXAMPLE, "")
    lines.push(
        "Part of [Valdres](https://valdres.dev) — reactive state management for React, Vue, Svelte, Solid, and Angular.",
        "",
        `Full documentation: ${pkg.docUrl}`,
    )
    return lines.join("\n")
}

async function docBody(pkg: PackageInfo): Promise<string> {
    const mdx = await Bun.file(pkg.mdxPath!).text()
    const warnings: string[] = []
    const md = mdxToMarkdown(mdx, {
        liveUrl: pkg.liveUrl,
        onWarn: m => warnings.push(m),
    })
    for (const w of warnings) console.warn(`  ${pkg.name}: ${w}`)
    return `${md.trim()}\n\n---\n\nFull documentation: ${pkg.docUrl}`
}

function splice(existing: string | null, generated: string): string | null {
    const block = `${START}\n\n${generated}\n\n${END}\n`
    if (existing) {
        const i = existing.indexOf(START)
        const j = existing.indexOf(END)
        if (i !== -1 && j !== -1) {
            return (
                existing.slice(0, i) +
                block.trimEnd() +
                existing.slice(j + END.length)
            )
        }
        // No markers but real hand-written content → don't clobber.
        if (existing.trim().length > 240) return null
    }
    return block
}

// Grouped package table spliced into the root README between
// <!-- PACKAGES:START --> / <!-- PACKAGES:END --> markers.
const PKG_START = "<!-- PACKAGES:START -->"
const PKG_END = "<!-- PACKAGES:END -->"

function packagesTable(packages: PackageInfo[]): string {
    const row = (p: PackageInfo) =>
        `| [\`${p.name}\`](${p.docUrl}) | ${p.description} |`
    const table = (items: PackageInfo[]) =>
        [
            "| Package | Description |",
            "|:--------|:------------|",
            ...items.map(row),
        ].join("\n")

    const core = packages.filter(p => p.name === "valdres")
    const adapters = packages.filter(p => /^valdres-/.test(p.name))
    const plugins = packages.filter(p => p.name.startsWith("@valdres/"))
    const reactExtras = packages.filter(p =>
        p.name.startsWith("@valdres-react/"),
    )

    return [
        PKG_START,
        "### Core",
        "",
        table(core),
        "",
        "### Framework adapters",
        "",
        table(adapters),
        "",
        "### Plugins (framework-agnostic)",
        "",
        table(plugins),
        "",
        "### React extras",
        "",
        table(reactExtras),
        PKG_END,
    ].join("\n")
}

async function updateRootReadme(
    packages: PackageInfo[],
    check: boolean,
): Promise<"ok" | "stale" | "skipped"> {
    const path = `${ROOT}/README.md`
    const existing = await Bun.file(path).text()
    const i = existing.indexOf(PKG_START)
    const j = existing.indexOf(PKG_END)
    if (i === -1 || j === -1) return "skipped"
    const next =
        existing.slice(0, i) +
        packagesTable(packages) +
        existing.slice(j + PKG_END.length)
    if (next === existing) return "ok"
    if (check) return "stale"
    await Bun.write(path, next)
    return "ok"
}

async function main() {
    const check = process.argv.includes("--check")
    const packages = await discoverPackages(ROOT)

    let written = 0
    const skipped: string[] = []
    const stale: string[] = []

    for (const pkg of packages) {
        const generated =
            pkg.mode === "doc" ? await docBody(pkg) : indexBody(pkg)
        const readmePath = `${pkg.dir}/README.md`
        const existing = (await Bun.file(readmePath).exists())
            ? await Bun.file(readmePath).text()
            : null
        const next = splice(existing, generated)

        if (next === null) {
            skipped.push(pkg.name)
            continue
        }
        if (existing === next) continue

        if (check) {
            stale.push(pkg.name)
        } else {
            await Bun.write(readmePath, next)
            written++
        }
    }

    const rootResult = await updateRootReadme(packages, check)
    if (rootResult === "stale") stale.push("README.md (root packages table)")
    if (rootResult === "skipped")
        console.log("Root README has no PACKAGES markers — table not written.")

    if (skipped.length) {
        console.log(
            `Skipped (hand-written README, no markers): ${skipped.join(", ")}`,
        )
    }

    if (check) {
        if (stale.length) {
            console.error(
                `README out of date for: ${stale.join(", ")}\nRun: bun run scripts/gen-readmes.ts`,
            )
            process.exit(1)
        }
        console.log(`All ${packages.length} package READMEs are up to date.`)
    } else {
        console.log(
            `Generated READMEs: ${written} updated, ${packages.length} packages total.`,
        )
    }
}

await main()
