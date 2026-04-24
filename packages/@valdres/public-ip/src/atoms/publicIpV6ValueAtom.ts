import { atom } from "valdres"

export const publicIpV6ValueAtom = atom<string | null>(null, {
    global: true,
    name: "@valdres/public-ip/v6-value",
})
