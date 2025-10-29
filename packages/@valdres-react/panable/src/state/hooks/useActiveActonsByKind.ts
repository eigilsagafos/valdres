import { useValue } from "valdres-react"
import type { ActionKind } from "../../types/ActionKind"
import { activeActionsByKindSelector } from "../selectors/activeActionsByKindSelector"

export const useActiveActonsByKind = (kind: ActionKind) =>
    useValue(activeActionsByKindSelector(kind))
