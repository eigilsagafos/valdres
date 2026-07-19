import { IS_PROD } from "../lib/IS_PROD"
import { getStoreData } from "../lib/getStoreData"
import { getNamedStateIndex } from "../lib/namedStateIndex"
import { encodeWireValue } from "../lib/wireCodec"
import type { DehydratedState } from "../types/DehydratedState"
import type { Store } from "../types/Store"
import { isAtomFamily } from "./isAtomFamily"
import { isPromiseLike } from "./isPromiseLike"

/** [Docs Reference](https://valdres.dev/valdres/api/dehydrate)
 *
 * Serialize a root store's named state into a JSON-serializable
 * `DehydratedState` payload — the server half of SSR state transfer (see
 * `hydrate` for the client half).
 *
 * Iterates a lazy per-store index of globally named state: every `name`d atom
 * gets an `atoms: [name, value]` entry and every `name`d atomFamily gets one
 * `families: [name, args, value]` entry per member in THIS store's membership.
 * Work is therefore proportional to the store being serialized, independent
 * of the process-global name registry and family identity caches shared by
 * other request stores.
 * Unnamed state is not transferable;
 * selectors are never included (they re-derive from hydrated atoms).
 *
 * Promise-pending values (in-flight async sets or unresolved async defaults)
 * are skipped with a dev-only warning — settle them before dehydrating.
 *
 * Atoms whose `schema` is bidirectional (zod 4 — every zod schema, and
 * meaningfully `z.codec`) are wire-encoded: the schema's encode direction
 * produces the JSON-safe value (BigInt → string, Date → ISO string, …) and the
 * entry is marked so `hydrate` decodes it back. JS-native values round-trip
 * through plain JSON this way — give the atom a codec schema and it just
 * works. A value that fails its own schema's encode throws (the payload would
 * be undecodable — fail on the server, where the bug is); a one-way transform
 * schema can't encode and falls back to the raw value with a dev warning.
 *
 * Root stores only: scoped stores are out of scope for v1 (the adapters' scope
 * `initialize` callback covers per-scope state) and throw.
 *
 * @example
 * const payload = dehydrate(store)
 * const html = `<script>window.__STATE__ = ${JSON.stringify(payload)}</script>`
 */
export const dehydrate = (store: Store): DehydratedState => {
    const data = getStoreData(store)
    if (data.parent) {
        throw new Error(
            "valdres: dehydrate(store) only supports root stores. Scoped " +
                "stores are out of scope for v1 — initialize scopes on the " +
                "hydrating side instead (adapters' scope `initialize`).",
        )
    }
    const atoms: DehydratedState["atoms"] = []
    const families: DehydratedState["families"] = []
    const namedStates = getNamedStateIndex(data)
    if (namedStates === undefined) return { atoms, families }
    for (const [state, name] of namedStates) {
        if (isAtomFamily(state)) {
            const members = data.values.get(state)
            if (members === undefined) continue
            for (const member of members) {
                if (!data.values.has(member)) continue
                // The payload contracts args as a non-empty tuple (mirroring
                // atomFamily's Args), and hydrate skips empty-args entries.
                // A zero-arg member can only exist via an untyped JS call —
                // don't emit an entry the other side cannot hydrate.
                if (member.familyArgs.length === 0) {
                    if (!IS_PROD)
                        console.warn(
                            `valdres: dehydrate skipped a '${name}' member created with zero args — it cannot be addressed by hydrate (family args must be a non-empty tuple).`,
                        )
                    continue
                }
                const value = data.values.get(member)
                if (isPromiseLike(value)) {
                    if (!IS_PROD)
                        console.warn(
                            `valdres: dehydrate skipped '${name}(${JSON.stringify(member.familyArgs).slice(1, -1)})' — its value is a pending promise. Settle async state before dehydrating.`,
                        )
                    continue
                }
                const wire = encodeWireValue(member, value)
                families.push(
                    wire.encoded
                        ? [name, member.familyArgs, wire.value, 1]
                        : [name, member.familyArgs, wire.value],
                )
            }
        } else {
            if (!data.values.has(state)) continue
            const value = data.values.get(state)
            if (isPromiseLike(value)) {
                if (!IS_PROD)
                    console.warn(
                        `valdres: dehydrate skipped '${name}' — its value is a pending promise. Settle async state before dehydrating.`,
                    )
                continue
            }
            const wire = encodeWireValue(state, value)
            atoms.push(
                wire.encoded ? [name, wire.value, 1] : [name, wire.value],
            )
        }
    }
    return { atoms, families }
}
