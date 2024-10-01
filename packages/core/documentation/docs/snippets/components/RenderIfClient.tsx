import { useEffect, useState } from "react"

export const RenderIfClient = ({ children }) => {
    const [isClient, setIsClient] = useState(false)
    useEffect(() => {
        setIsClient(true)
    }, [])

    if (isClient) return <>{children}</>
    return <></>
}
