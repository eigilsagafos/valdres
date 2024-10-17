import { faker } from "@faker-js/faker"
import { atom } from "valdres-react"

const fetchCurrentUserId = () => faker.string.uuid()

export const currentUserIdAtom = atom(fetchCurrentUserId)
