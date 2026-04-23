import { isValidIpV4 } from "./isValidIpV4"
import { isValidIpV6 } from "./isValidIpV6"

export const isValidIp = (value: string): boolean =>
    isValidIpV4(value) || isValidIpV6(value)
