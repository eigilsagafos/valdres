import { atomFamily } from "../atomFamily"

const defaultValue = 0

atomFamily(defaultValue, { global: true, name: "named-global-family" })

if (false) {
    // @ts-expect-error global atom families require a stable name
    atomFamily(defaultValue, { global: true })
}
