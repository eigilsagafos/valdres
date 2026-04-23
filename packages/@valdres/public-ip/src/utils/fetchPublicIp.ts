import { isValidIp } from "../lib/isValidIp"

export const fetchPublicIp = async (endpoints: string[]): Promise<string> => {
    const errors: unknown[] = []
    for (const endpoint of endpoints) {
        try {
            const response = await fetch(endpoint)
            if (!response.ok) {
                errors.push(new Error(`${endpoint} responded ${response.status}`))
                continue
            }
            const body = (await response.text()).trim()
            if (!isValidIp(body)) {
                errors.push(new Error(`${endpoint} returned non-IP body`))
                continue
            }
            return body
        } catch (error) {
            errors.push(error)
        }
    }
    throw new AggregateError(errors, "All public-ip endpoints failed")
}
