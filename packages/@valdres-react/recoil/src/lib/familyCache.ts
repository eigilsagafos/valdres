import { stableStringify } from "./stableStringify"

interface CachePolicyForParams {
    readonly equality?: "value" | "reference"
}

/**
 * Recoil's family member cache: keep every member, keyed by the parameter's
 * stable serialization (`value`, the default) or by the parameter itself
 * (`reference`).
 */
export const createFamilyCache = <Member>(
    policy: CachePolicyForParams | undefined,
    lookupError: (error: Error) => Error = error => error,
) => {
    const equality = policy?.equality ?? "value"
    if (equality !== "value" && equality !== "reference")
        throw new Error(`Unrecognized equality policy ${String(equality)}`)
    const members = new Map<unknown, Member>()
    const keyOf = (param: unknown) => {
        if (equality === "reference") return param
        try {
            return stableStringify(param)
        } catch (error) {
            throw lookupError(error as Error)
        }
    }
    return (param: unknown, create: () => Member): Member => {
        const key = keyOf(param)
        let member = members.get(key)
        if (member === undefined) {
            member = create()
            members.set(key, member)
        }
        return member
    }
}
