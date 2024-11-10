import { faker } from "@faker-js/faker"
import { atom } from "valdres"

const fetchCurrentUserId = () => faker.string.uuid()

export const currentUserIdAtom = atom(fetchCurrentUserId)
