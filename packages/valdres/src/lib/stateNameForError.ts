import type { Atom } from "../types/Atom"
import type { AtomFamily } from "../types/AtomFamily"
import { getRegisteredName } from "./registerName"

/** Prefer the immutable registry address, then fall back to a selector or
 * family-member display name. Invalid public inputs may be arbitrary values. */
export const stateNameForError = (state: unknown): string | undefined => {
    if (
        state === null ||
        (typeof state !== "object" && typeof state !== "function")
    ) {
        return undefined
    }
    const registeredName = getRegisteredName(
        state as Atom<any> | AtomFamily<any, any>,
    )
    if (registeredName !== undefined) return registeredName
    const name = (state as { name?: unknown }).name
    return typeof name === "string" && name.length > 0 ? name : undefined
}

export const stateNameSuffix = (state: unknown): string => {
    const name = stateNameForError(state)
    return name === undefined ? "" : ` '${name}'`
}
