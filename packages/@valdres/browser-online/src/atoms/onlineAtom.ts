import { externalAtom, type ExternalAtom } from "valdres"
import { onlineSource } from "../lib/onlineSource"

export const onlineAtom: ExternalAtom<boolean> = externalAtom(onlineSource, {
    name: "@valdres/browser-online/online",
})
