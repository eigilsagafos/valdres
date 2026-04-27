import { atom } from "valdres"

export const publicIpErrorAtom = atom<Error | null>(null, {
    global: true,
    name: "@valdres/public-ip/error",
})
