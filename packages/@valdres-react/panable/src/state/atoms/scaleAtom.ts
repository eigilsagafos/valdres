import { atomFamily } from "valdres-react"
import type { ScopeId } from "../../types/ScopeId"

export const scaleAtom = atomFamily<ScopeId, number>(1.0, {
    label: "@valdres-react/panable/scaleAtom",
})
