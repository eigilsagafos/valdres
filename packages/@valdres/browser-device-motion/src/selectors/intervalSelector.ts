import { selector } from "valdres"
import { motionAtom } from "../atoms/motionAtom"

export const intervalSelector = selector(
    get => get(motionAtom)?.interval ?? null,
    { name: "@valdres/browser-device-motion/interval" },
)
