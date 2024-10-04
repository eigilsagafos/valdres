import { atomFamily as valdresAtomFamily } from "valdres-react"
import { type SerializableParam, type AtomFamilyOptions } from "recoil"

// recoilAtomFamily()

export const atomFamily = <T, P extends SerializableParam>(
    options: AtomFamilyOptions<T, P>,
) => {
    // @ts-ignore @ts-todo
    return valdresAtomFamily(options.default, { label: options.key })
}
