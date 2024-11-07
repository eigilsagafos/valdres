import { atomFamily as valdresAtomFamily } from "valdres-react"
import { type SerializableParam, type AtomFamilyOptions } from "recoil"

export const atomFamily = <T, P extends SerializableParam>(
    options: AtomFamilyOptions<T, P>,
) => {
    // @ts-ignore @ts-todo
    return valdresAtomFamily<P, T>(options.default, { name: options.key })
}
