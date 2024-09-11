import { atom, createStore, selector } from "valdres"

const store = createStore()
const temperature = atom(85)
const temperatureInCelcius = selector(get => {
    const f = get(temperature)
    return ((f - 32) * 5) / 9
})

export const Temperature = () => {
    return (
        <div>
            {store.get(temperature)}°F is{" "}
            {store.get(temperatureInCelcius).toFixed(1)}°C
        </div>
    )
}
