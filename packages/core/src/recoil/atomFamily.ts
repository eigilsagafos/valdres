import { atomFamily as baseAtomFamily} from "../atomFamily"
import {
    type SerializableParam,
    type AtomFamilyOptions
} from "recoil"

// recoilAtomFamily()


export const atomFamily = <T, P extends SerializableParam>(options: AtomFamilyOptions<T, P>) => {
    return baseAtomFamily(options.default, options.key)
}

