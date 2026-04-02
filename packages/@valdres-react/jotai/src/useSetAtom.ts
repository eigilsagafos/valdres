import { useAtom } from "./useAtom"

export const useSetAtom = (atom: any) => {
    const [, setAtom] = useAtom(atom)
    return setAtom
}
