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
            // @ts-ignore
            currentCodeCombinationAtom.setSelf(newCode)
            // @ts-ignore
            eventByCodeAtom(newCode).setSelf(event)

            const currentKey = currentKeyCombinationAtom.getSelf()
            const newKey = [...currentKey, key]
            currentKeyCombinationAtom.setSelf(newKey)
            // @ts-ignore
            eventByKeyAtom(newKey).setSelf(event)
        }
    } else if (type === "keyup") {
        const currentCode = currentCodeCombinationAtom.getSelf()
        // @ts-ignore
        eventByCodeAtom(currentCode).setSelf(event)
        // @ts-ignore
        currentCodeCombinationAtom.setSelf(curr =>
            // @ts-ignore
            curr.filter(existingCode => existingCode !== code),
        )

        const currentKey = currentKeyCombinationAtom.getSelf()
        // @ts-ignore
        eventByKeyAtom(currentKey).setSelf(event)
        // @ts-ignore
        currentKeyCombinationAtom.setSelf(curr =>
            // @ts-ignore
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
