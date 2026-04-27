import { atom } from "valdres"

export const publicIpValueAtom = atom<string | null>(null, {
    global: true,
    name: "@valdres/public-ip/value",
})
