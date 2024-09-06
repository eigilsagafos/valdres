import { faker } from "@faker-js/faker"

export const generateFakeUsers = (size: number) => {
    return Array.from({ length: size }, () => ({
        id: faker.string.uuid(),
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
        email: faker.internet.email(),
    }))
}
