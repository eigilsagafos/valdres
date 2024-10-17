import { useValue } from "valdres-react"
import { userAtom } from "./state/atoms/userAtom"

export function UserAvatar({ userId }: { userId: string }) {
    const { avatar } = useValue(userAtom(userId))
    return (
        <img
            key={avatar}
            src={avatar}
            style={{ height: "100%", borderRadius: "100%" }}
        />
    )
}
