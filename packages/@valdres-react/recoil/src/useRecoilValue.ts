import { useValue } from "valdres-react"
import { useRecoilValue as useRecoilValue_original } from "recoil"

export const useRecoilValue = useValue as typeof useRecoilValue_original
