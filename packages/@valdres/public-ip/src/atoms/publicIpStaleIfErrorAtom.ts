import { atom } from "valdres"

export const publicIpStaleIfErrorAtom = atom<number>(Infinity, {
    global: true,
    name: "@valdres/public-ip/staleIfError",
})
