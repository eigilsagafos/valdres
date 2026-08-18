import { globalAtomFamily } from "../globalAtomFamily"

const defaultValue = 0

globalAtomFamily(defaultValue, { name: "named-global-family" })

if (false) {
    // @ts-expect-error global atom families require a stable name
    globalAtomFamily(defaultValue, {})
}
