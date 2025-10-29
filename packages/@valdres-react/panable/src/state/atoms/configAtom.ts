import { atom } from "valdres"
import type { Config } from "../../types/Config"

export const configAtom = atom<Config>(
    { mode: "pan" },
    { name: "@valdres-react/panable/configAtom" },
)
