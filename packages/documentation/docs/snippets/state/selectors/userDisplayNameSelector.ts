import { selectorFamily } from "valdres-react"
import { userAtom } from "../atoms/userAtom"

export const userDisplayNameSelector = selectorFamily(id => get => {
    const { firstName, lastName } = get(userAtom(id))
    return `${firstName} ${lastName}`
})