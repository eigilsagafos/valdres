---
"valdres": minor
---

Add opt-in runtime schema validation for atoms and selectors.

Pass a `schema` to an atom, selector, or family. Any **Standard Schema**
(https://standard-schema.dev — Zod 3.24+/4, Valibot, ArkType, …) works, as does
any classic validator with a `parse(value)` method. The schema also drives type
inference, so `atom(undefined, { schema: z.string() })` is typed as
`Atom<string>` without a generic. The schema is readable back off any atom,
selector, or family object via `.schema` (families expose it without
materializing a member), so consumers like devtools or a sync layer can
validate values against a state's declared shape.

```ts
const user = atom({ name: "Ada", age: 36 }, {
    schema: z.object({ name: z.string(), age: z.number().min(0) }),
})

// validation is opt-in per store, off by default
const s = store({ schemaValidation: true })
s.set(user, { name: "Bob", age: -1 }) // throws SchemaValidationError
```

Design:

- **Opt-in, inherited like `enumerable`.** Off by default; enable per store with
  `store({ schemaValidation: true })`. Scopes inherit it from their parent, so it
  stays off the hot path for the common (production) case and serves as a
  development-time safety net. An individual atom/selector can override the store
  with its own `schemaValidation: true` (always validate a boundary atom, even in
  a store with validation off) or `schemaValidation: false` (exempt a hot one).

- **Validate-only.** The schema runs purely for its rejecting side effect; the
  original value is stored unchanged. A store with validation on therefore stores
  the same value as one with it off — no dev/prod divergence. Note this means a
  transforming/coercing schema (`z.coerce.number()`, `z.string().trim()`,
  `z.string().default(...)`) validates but does **not** transform; avoid those
  here (the inferred type follows the schema's output while the stored value is
  the input).

- **Validated at the write boundaries.** Atom init (static, function, async, and
  selector defaults), atom `set` (sync + async), selector evaluation (sync +
  async), deleted-family-member reads, and `store.txn()` — transaction writes
  validate at staging time, so an invalid value throws in the txn body and aborts
  the whole transaction (atomic). Batched stores validate too.

- **Errors name the culprit.** Sync failures throw a `SchemaValidationError`
  (exported) that names the offending atom/selector and keeps the library-native
  error (e.g. a Zod `ZodError`) on `cause`, instead of a raw error from deep
  inside the store. Async failures (a promise resolving to an invalid value)
  can't be thrown to the caller, so they're reported via `console.error` and the
  invalid value is never committed.

Known limitations:

- A **promise set inside `store.txn()`** is stored as-is and not auto-resolved
  by the transaction (pre-existing behavior), so it is not validated on resolve.
  Validate before setting, or set outside a transaction.
- An invalid **async default/selector** drops its value (so a re-read re-inits) —
  the same as a rejecting async default. Under React Suspense a component that
  keeps re-reading will re-init/re-fetch; validate at the data boundary rather
  than relying on async-default validation under Suspense.
- Asynchronous schema validation (an async Standard Schema, or a Zod schema with
  an async refinement) is not supported on the synchronous validation path and
  surfaces as an error; use synchronous schemas.
