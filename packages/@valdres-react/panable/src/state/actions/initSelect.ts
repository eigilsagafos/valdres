import type { TransactionInterface } from "valdres-react"
import type { EventId } from "../../types/EventId"
import type { ScopeId } from "../../types/ScopeId"
import { actionAtom } from "../atoms/actionAtom"
import { activeActionsAtom } from "../atoms/activeActionsAtom"
import { cursorPositionRelativeSelector } from "../selectors/cursorPositionRelativeSelector"
// import { renderSettingsAtomByEntity } from '../../../state/utils/renderSettingsAtomByEntity'
// import { selectedProcessItemsSelector } from '../../../state/selectors/selectedProcessItemsSelector'
// import { cursorPositionRelativeSelector } from "../../../dist"

export const initSelect = (
    txn: TransactionInterface,
    scopeId: ScopeId,
    eventId: EventId,
    e,
) => {
    txn.set(activeActionsAtom(scopeId), curr => [...curr, [eventId, "select"]])
    let initialSelected = []
    throw new Error("TODO: Support onInitSelect callback")
    // if (state.get(isModifierKeyActiveAtom("shift"))) {
    //     initialSelected = state.get(selectedProcessItemsSelector(scopeId))
    // } else {
    //     state.get(selectedProcessItemsSelector(scopeId)).forEach(item => {
    //         const atom = renderSettingsAtomByEntity(item.entity)({
    //             ref: item.ref,
    //             context: item.context,
    //             scopeId,
    //         })
    //         state.set(atom, curr => ({
    //             ...curr,
    //             selected: false,
    //         }))
    //     })
    //     initialSelected = []
    // }

    txn.set(actionAtom({ eventId, scopeId }), {
        kind: "select",
        eventId,
        scopeId,
        initialEvent: e,
        initialSelectedRefs: initialSelected,
        startPosition: txn.get(cursorPositionRelativeSelector({ scopeId })),
        selectedRefsFromPreviousUpdate: [],
    })
}
