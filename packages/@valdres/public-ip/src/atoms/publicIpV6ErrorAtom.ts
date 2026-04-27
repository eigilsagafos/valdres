import { atom } from "valdres"

export const publicIpV6ErrorAtom = atom<Error | null>(null, {
    global: true,
    name: "@valdres/public-ip/v6Error",
})
