import { atom } from "valdres"

export const publicIpV4ValueAtom = atom<string | null>(null, {
    global: true,
    name: "@valdres/public-ip/v4-value",
})
