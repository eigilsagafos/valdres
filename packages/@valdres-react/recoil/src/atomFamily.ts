import { atomFamily as valdresAtomFamily } from "valdres-react"
import { type SerializableParam, type AtomFamilyOptions } from "recoil"

// recoilAtomFamily()

export const atomFamily = <T, P extends SerializableParam>(
    options: AtomFamilyOptions<T, P>,
) => {
    return valdresAtomFamily(options.default, options.key)
}
