const ipv4 = /^(25[0-5]|2[0-4]\d|[01]?\d?\d)(\.(25[0-5]|2[0-4]\d|[01]?\d?\d)){3}$/

export const isValidIpV4 = (value: string): boolean => ipv4.test(value.trim())
