// Type-level half of docs/test/core-claims.test.ts: the option bags and write
// methods the atom and selector pages document. Checked with tsgo; never run.
import { atom, deepEqual, selector, store, type AtomOptions, type SelectorOptions } from "valdres"

const app = store()
const countAtom = atom(0)

// Current v1 options: name and equal.
atom({ blocks: [] as number[] }, { name: "document", equal: deepEqual })
atom.lazy(() => 0, { name: "lazy", equal: Object.is })
selector(get => get(countAtom) * 2, { name: "doubled", equal: Object.is })

// Legacy options are not part of AtomOptions or SelectorOptions.
// @ts-expect-error mutable is a legacy option
atom(new Map(), { mutable: true })
// @ts-expect-error schema is a legacy option
atom("", { schema: {} })
// @ts-expect-error maxAge is a legacy option
atom(0, { maxAge: 30_000 })
// @ts-expect-error mutable is a legacy option
selector(() => 1, { mutable: true })
// @ts-expect-error schemaValidation is a legacy option
selector(() => 1, { schemaValidation: true })

// set stores a value; update takes the updater.
app.set(countAtom, 42)
app.update(countAtom, count => count + 1)
// @ts-expect-error set does not call updaters
app.set(countAtom, (count: number) => count + 1)

// atom(fn) is an atom whose value is the function.
const onSaveAtom = atom(() => {})
const onSave: () => void = app.get(onSaveAtom)
onSave()

export type Checked = [AtomOptions<number>, SelectorOptions<number>]
