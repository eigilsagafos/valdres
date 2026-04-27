import { isValidIp } from "../lib/isValidIp"

const DEFAULT_REQUEST_TIMEOUT_MS = 4000

export const fetchPublicIp = async (
    endpoints: string[],
    validate: (value: string) => boolean = isValidIp,
    timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<string> => {
    const errors: unknown[] = []
    for (const endpoint of endpoints) {
        const controller = new AbortController()
        const timeoutId = setTimeout(
            () => controller.abort(new Error(`${endpoint} timed out`)),
            timeoutMs,
        )
        try {
            const response = await fetch(endpoint, {
                signal: controller.signal,
            })
            if (!response.ok) {
                errors.push(
                    new Error(`${endpoint} responded ${response.status}`),
                )
                continue
            }
            const body = (await response.text()).trim()
            if (!validate(body)) {
                errors.push(new Error(`${endpoint} returned non-IP body`))
                continue
            }
            return body
        } catch (error) {
            errors.push(error)
        } finally {
            clearTimeout(timeoutId)
        }
    }
    throw new AggregateError(errors, "All public-ip endpoints failed")
}
