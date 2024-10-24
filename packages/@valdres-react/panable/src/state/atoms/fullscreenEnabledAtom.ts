import { atomFamily } from "valdres-react"
import type { ScopeId } from "../../types/ScopeId"

export const fullscreenEnabledAtom = atomFamily<ScopeId, boolean>(false, {
    label: "@valdres-react/panable/fullscreenEnabledAtom",
})
