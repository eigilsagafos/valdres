import { atom } from "valdres"

export const publicIpV4ErrorAtom = atom<Error | null>(null, {
    global: true,
    name: "@valdres/public-ip/v4Error",
})
