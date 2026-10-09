import { selector, type Selector } from "valdres"
import { motionAtom } from "./motionAtom"

export const intervalSelector: Selector<number | null> = selector(
    get => get(motionAtom)?.interval ?? null,
    { name: "@valdres/browser-device-motion/interval" },
)
