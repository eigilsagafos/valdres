import type { AtomFamily } from "valdres"
import { currentCodeCombinationAtom } from "./currentCodeCombinationAtom"
import { currentKeyCombinationAtom } from "./currentKeyCombinationAtom"
import { eventByCodeAtom } from "./eventByCodeAtom"
import { eventByKeyAtom } from "./eventByKeyAtom"
import { isAppleLike } from "./lib/isAppleLike"
import type { KeyboardCode } from "./types/KeyboardCode"

const isElementLastInArray = (element: any, array: any[]) => {
    return array.indexOf(element) === array.length - 1
}

const cleanupMissingKeyups = (
    eventAtom: AtomFamily<string[]>,
    array: string[],
    item: string,
    event: KeyboardEvent,
) => {
    const index = array.indexOf(item)
    const correctedArray = array.slice(0, index + 1)
    const itemsToRemove = array.slice(index + 1)
    itemsToRemove.forEach((_, index) => {
        const items = itemsToRemove.slice(0, index + 1)
        // @ts-ignore
        eventAtom([...correctedArray, ...items]).setSelf(event)
    })
    return correctedArray
}

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
        // if (!repeat) {
        let currentCode = currentCodeCombinationAtom.getSelf()
        let currentKey = currentKeyCombinationAtom.getSelf()

        if (isAppleLike()) {
            if (currentCode.includes("MetaLeft")) {
                currentCode = cleanupMissingKeyups(
                    //@ts-ignore
                    eventByCodeAtom,
                    currentCode,
                    "MetaLeft",
                    null,
                ) as KeyboardCode[]
            }
            if (currentCode.includes("MetaRight")) {
                currentCode = cleanupMissingKeyups(
                    //@ts-ignore
                    eventByCodeAtom,
                    currentCode,
                    "MetaRight",
                    null,
                ) as KeyboardCode[]
            }
            if (currentKey.includes("Meta")) {
                currentKey = cleanupMissingKeyups(
                    //@ts-ignore
                    eventByKeyAtom,
                    currentKey,
                    "Meta",
                    null,
                ) as KeyboardCode[]
            }
        }

        let newCode
        if (currentCode.includes(code as KeyboardCode)) {
            newCode = currentCode
        } else {
            newCode = [...currentCode, code]
        }

        let newKey
        if (currentKey.includes(key)) {
            newKey = currentKey
        } else {
            newKey = [...currentKey, key]
        }
        // @ts-ignore
        currentCodeCombinationAtom.setSelf(newCode)
        // @ts-ignore
        eventByCodeAtom(newCode).setSelf(event)

        currentKeyCombinationAtom.setSelf(newKey)
        // @ts-ignore
        eventByKeyAtom(newKey).setSelf(event)
    } else if (type === "keyup") {
        let currentCode = currentCodeCombinationAtom.getSelf()
        let currentKey = currentKeyCombinationAtom.getSelf()
        if (isAppleLike()) {
            if (!isElementLastInArray(code, currentCode)) {
                currentCode = cleanupMissingKeyups(
                    //@ts-ignore
                    eventByCodeAtom,
                    currentCode,
                    code,
                    event,
                ) as KeyboardCode[]
            }
            if (!isElementLastInArray(key, currentKey)) {
                currentKey = cleanupMissingKeyups(
                    //@ts-ignore
                    eventByKeyAtom,
                    currentKey,
                    key,
                    event,
                )
            }
        }
        currentCodeCombinationAtom.setSelf(
            currentCode.filter(existingCode => existingCode !== code),
        )
        currentKeyCombinationAtom.setSelf(
            currentKey.filter(existingKey => existingKey !== key),
        )
        // @ts-ignore
        eventByCodeAtom(currentCode).setSelf(event)

        // @ts-ignore
        eventByKeyAtom(currentKey).setSelf(event)
    } else {
        console.error("Unkown keyboard event type")
    }
}
