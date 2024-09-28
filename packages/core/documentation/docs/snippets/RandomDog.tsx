import { Suspense } from "react"
import { useResetValdresState, atom, useValdresValue } from "valdres-react"

const randomDogImage = atom(() =>
    fetch("https://random.dog/woof.json")
        .then(res => res.json())
        .then(body => body.url),
)

const isVideo = (url: string) => url.match(/(?:mp4|webm)$/)

const RandomDogImage = () => {
    const url = useValdresValue(randomDogImage)
    const reset = useResetValdresState(randomDogImage)
    return (
        <div>
            <button onClick={reset}>Next dog please!</button>
            {!isVideo(url) && <img src={url} />}
            {isVideo(url) && <video src={url} autoPlay loop />}
        </div>
    )
}

export const RandomDog = () => {
    return (
        <Suspense fallback={<>Loading...</>}>
            <RandomDogImage />
        </Suspense>
    )
}
