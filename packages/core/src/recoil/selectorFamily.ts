import { selectorFamily as baseSelectorFamily} from "../selectorFamily"
import {
    type SerializableParam,
    type ReadWriteSelectorFamilyOptions,
    type ReadOnlySelectorFamilyOptions
} from "recoil"


export const selectorFamily = <T, P extends SerializableParam>(options: ReadWriteSelectorFamilyOptions<T, P> | ReadOnlySelectorFamilyOptions<T, P>
) => {
    return baseSelectorFamily(
        (key) => (get) => options.get(key)({get}), 
        options.key
    )
}

