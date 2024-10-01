import { faker } from "@faker-js/faker"
import { atomFamily } from "valdres-react"

export const userAtom = atomFamily(id => ({
    id,
    avatar: faker.image.avatarGitHub(),
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    email: faker.internet.email(),
}))
