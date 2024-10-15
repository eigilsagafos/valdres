import { useValue } from "valdres-react"
import { useRecoilValue as useRecoilValue_old } from "recoil"

export const useRecoilValue = useValue as typeof useRecoilValue_old
