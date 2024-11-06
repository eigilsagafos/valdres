import { atomFamily } from "valdres-react"
import type { ScopeId } from "../../types/ScopeId"
import type { Config } from "../../types/Config"

export const configAtom = atomFamily<ScopeId, Config>(
    { mode: "pan" },
    {
        label: "@valdres-react/panable/configAtom",
    },
)