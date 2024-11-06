import { currentCodeCombinationAtom } from "./currentCodeCombinationAtom"
import { currentKeyCombinationAtom } from "./currentKeyCombinationAtom"
import { eventByCodeAtom } from "./eventByCodeAtom"
import { eventByKeyAtom } from "./eventByKeyAtom"

export const eventHandler = (event: KeyboardEvent) => {
    const {
        type,
        code,
        key,
        repeat,
        ctrlKey,
        altKey,
        metaKey,
        shiftKey,
        target,
        timeStamp,
    } = event

    if (type === "keydown") {
        if (!repeat) {
            const currentCode = currentCodeCombinationAtom.getSelf()
            const newCode = [...currentCode, code]
            currentCodeCombinationAtom.setSelf(newCode)
            eventByCodeAtom(newCode).setSelf(event)

            const currentKey = currentKeyCombinationAtom.getSelf()
            const newKey = [...currentKey, key]
            currentKeyCombinationAtom.setSelf(newKey)
            eventByKeyAtom(newKey).setSelf(event)
        }
    } else if (type === "keyup") {
        const currentCode = currentCodeCombinationAtom.getSelf()
        eventByCodeAtom(currentCode).setSelf(event)
        currentCodeCombinationAtom.setSelf(curr =>
            curr.filter(existingCode => existingCode !== code),
        )

        const currentKey = currentKeyCombinationAtom.getSelf()
        eventByKeyAtom(currentKey).setSelf(event)
        currentKeyCombinationAtom.setSelf(curr =>
            curr.filter(existingKey => existingKey !== key),
        )
    } else {
        console.error("Unkown keyboard event type")
    }
}

if (window) {
    window.addEventListener("keydown", eventHandler)
    window.addEventListener("keyup", eventHandler)
}