// Deterministic synthetic movie dataset for the faceted-search demo.
// No Math.random — a seeded LCG so the corpus is identical every load
// (and could double as a fixture for a future facet differential test).

export type Movie = {
    id: string
    title: string
    genres: string[]
    year: number
    decade: number
    rating: number // 1.0 – 9.9
    director: string
    runtime: number // minutes
    cast: string[]
}

export const GENRES = [
    "Action",
    "Adventure",
    "Animation",
    "Comedy",
    "Crime",
    "Documentary",
    "Drama",
    "Family",
    "Fantasy",
    "History",
    "Horror",
    "Music",
    "Mystery",
    "Romance",
    "Sci-Fi",
    "Thriller",
    "War",
    "Western",
] as const

const DIRECTORS = [
    "Ava Mercer", "Ravi Anand", "Lena Sørensen", "Marcus Webb", "Yuki Tanaka",
    "Sofia Russo", "Diego Vargas", "Naomi Klein", "Tomas Holm", "Priya Nair",
    "Felix Braun", "Mara Lindqvist", "Hassan Reza", "Clara Dupont", "Owen Pierce",
    "Ingrid Vogel", "Kenji Mori", "Rosa Iglesias", "Viktor Petrov", "Amara Okafor",
    "Elias Nyström", "Bianca Conti", "Samuel Adeyemi", "Greta Falk", "Noah Sterling",
    "Aiko Watanabe", "Lucas Moreau", "Petra Novak", "Idris Cole", "Hana Park",
    "Theo Castellano", "Maya Lindgren", "Oscar Reyes", "Nadia Haddad", "Erik Solberg",
    "Camila Ortiz", "Anton Kovač", "Leila Farahani", "Gustav Berg", "Mia Sandoval",
    "Rafael Costa", "Junko Saito", "Dmitri Volkov", "Saoirse Byrne", "Pablo Esteban",
    "Freya Lund", "Karim Aziz", "Nora Eklund", "Hugo Albrecht", "Tara Devi",
] as const

const ACTORS = [
    "Liam Frost", "Zoe Calder", "Eli Marsh", "Nina Roy", "Cole Banner",
    "Ada Vance", "Reed Sterling", "Maya Quinn", "Jonah Pike", "Iris Lang",
    "Sam Ortega", "Vera Knox", "Dario Vale", "Lucy Hale", "Otto Brandt",
    "Selena Ríos", "Milo Hart", "Greta Sun", "Kai Rivera", "Nadia Wolfe",
    "Bruno Marchetti", "Esme Laurent", "Tariq Bello", "Olive Penn", "Hugo Reyes",
    "Stella Voss", "Dean Archer", "Lila Bright", "Axel Storm", "June Park",
    "Ravi Sen", "Mabel Cruz", "Finn Doyle", "Petra Kessler", "Omar Said",
    "Cleo Adler", "Hank Mercer", "Ruby Tan", "Levi Stone", "Anya Petrov",
    "Caleb North", "Dahlia Frost", "Marco Bianchi", "Tess Halloran", "Yusuf Demir",
    "Greer Wallace", "Soren Vik", "Mira Devine", "Beau Carter", "Lana Iverson",
    "Niko Kane", "Faye Lindberg", "Rashid Amari", "Bex Conway", "Ivo Ramos",
    "Carmen Lopez", "Dex Holloway", "Suri Mehta", "Knox Daley", "Vivi Laurent",
] as const

const ADJ = [
    "Last", "Dark", "Silent", "Eternal", "Broken", "Hidden", "Final", "Golden",
    "Crimson", "Frozen", "Lost", "Savage", "Secret", "Wild", "Burning", "Quiet",
    "Distant", "Endless", "Fearless", "Forgotten", "Shattered", "Velvet", "Iron",
    "Midnight", "Scarlet", "Restless", "Bitter", "Sacred", "Hollow", "Radiant",
]
const NOUN = [
    "Kingdom", "Shadow", "Empire", "Promise", "Horizon", "Legacy", "Storm",
    "Dream", "Echo", "Voyage", "Cipher", "Garden", "Throne", "Mirage", "Sentinel",
    "Paradox", "Requiem", "Odyssey", "Harvest", "Lantern", "Compass", "Ember",
    "Tide", "Verdict", "Pilgrim", "Falcon", "Anthem", "Glacier", "Maverick", "Oath",
]
const PLACE = [
    "Paris", "Tokyo", "the North", "Eden", "Mars", "the Deep", "Cairo", "Avalon",
    "the Frontier", "Nightfall", "Babel", "the Hollow", "Saturn", "the Wastes",
]

const lcg = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 0x100000000
}

const generate = (count: number): Movie[] => {
    const rnd = lcg(0x1d_ea_5)
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)]
    const cap = (s: string) => s[0].toUpperCase() + s.slice(1)

    const title = (): string => {
        const r = rnd()
        if (r < 0.34) return `The ${pick(ADJ)} ${pick(NOUN)}`
        if (r < 0.58) return `${pick(NOUN)} of ${pick(PLACE)}`
        if (r < 0.76) return `${pick(ADJ)} ${pick(NOUN)}`
        if (r < 0.9) return `${cap(pick(PLACE))}`
        return `${pick(NOUN)} & ${pick(NOUN)}`
    }

    const movies: Movie[] = []
    for (let i = 0; i < count; i++) {
        // 1–3 distinct genres, biased toward 1–2.
        const nGenres = 1 + Math.floor(rnd() * rnd() * 3)
        const genres: string[] = []
        while (genres.length < nGenres) {
            const g = pick(GENRES)
            if (!genres.includes(g)) genres.push(g)
        }
        // Year biased toward recent (sqrt skew); clamp to 2024.
        const year = Math.min(2024, 1950 + Math.floor(Math.sqrt(rnd()) * 75))
        // Rating: sum of three uniforms → bell around ~6.5.
        const rating =
            Math.round(
                Math.min(9.9, Math.max(1, 3 + ((rnd() + rnd() + rnd()) / 3) * 6.5)) *
                    10,
            ) / 10
        const cast: string[] = []
        while (cast.length < 3) {
            const a = pick(ACTORS)
            if (!cast.includes(a)) cast.push(a)
        }
        movies.push({
            id: `m${i}`,
            title: title(),
            genres,
            year,
            decade: Math.floor(year / 10) * 10,
            rating,
            director: pick(DIRECTORS),
            runtime: 80 + Math.floor(rnd() * 120),
            cast,
        })
    }
    return movies
}

export const MOVIES: Movie[] = generate(5000)

export const MOVIES_BY_ID: Map<string, Movie> = new Map(
    MOVIES.map(m => [m.id, m]),
)

export const DECADES: number[] = [...new Set(MOVIES.map(m => m.decade))].sort(
    (a, b) => a - b,
)
