import { selectorFamily as valdresSelectorFamily } from "valdres-react"
import {
    type SerializableParam,
    type ReadWriteSelectorFamilyOptions,
    type ReadOnlySelectorFamilyOptions,
} from "recoil"

export const selectorFamily = <T, P extends SerializableParam>(
    options:
        | ReadWriteSelectorFamilyOptions<T, P>
        | ReadOnlySelectorFamilyOptions<T, P>,
) => {
    return valdresSelectorFamily(
        // @ts-ignore @ts-todo
        key => get => options.get(key)({ get }),
        {
            label: options.key,
        },
    )
}
