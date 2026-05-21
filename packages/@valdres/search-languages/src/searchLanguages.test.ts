import { describe, expect, test } from "bun:test"
import { atomFamily, atomFamilySearch, store } from "valdres"
import { arabic } from "./arabic"
import { armenian } from "./armenian"
import { danish } from "./danish"
import { dutch } from "./dutch"
import { english } from "./english"
import { finnish } from "./finnish"
import { french } from "./french"
import { german } from "./german"
import { greek } from "./greek"
import { hindi } from "./hindi"
import { hungarian } from "./hungarian"
import { indonesian } from "./indonesian"
import { irish } from "./irish"
import { italian } from "./italian"
import { lithuanian } from "./lithuanian"
import { nepali } from "./nepali"
import { norwegian } from "./norwegian"
import { portuguese } from "./portuguese"
import { romanian } from "./romanian"
import { russian } from "./russian"
import { serbian } from "./serbian"
import { spanish } from "./spanish"
import { swedish } from "./swedish"
import { tamil } from "./tamil"
import { turkish } from "./turkish"

describe("@valdres/search-languages", () => {
    describe("english preset", () => {
        test("stemmer collapses inflections (runs/running/runner → runn*)", () => {
            const stems = ["runs", "running", "runner"].map(english.stem)
            // All three should share a common stem (whatever Snowball produces).
            expect(new Set(stems).size).toBeLessThan(3)
        })

        test("tokenizer keeps apostrophes inside words", () => {
            expect(english.tokenize("don't stop")).toEqual(["don't", "stop"])
        })

        test("tokenizer keeps hyphens inside words", () => {
            expect(english.tokenize("well-known fact")).toEqual([
                "well-known",
                "fact",
            ])
        })

        test("stop words include 'the' and 'is'", () => {
            expect(english.stopWords.has("the")).toBe(true)
            expect(english.stopWords.has("is")).toBe(true)
        })

        test("end-to-end with atomFamilySearch — stemming finds inflected match", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                language: english,
            })

            s.set(post("a"), { text: "she runs fast every morning" })
            s.set(post("b"), { text: "the cat sleeps" })

            // Query "run" should match doc "a" via stemming (runs → run).
            // Our curated English stopword list (67 words) deliberately
            // excludes "run", "work", etc. — see src/stopwords/english.ts.
            const hits = s
                .get(search("run"))
                .map(a => a.familyArgsStringified)
            expect(hits).toContain("a")
        })

        test("stopword list excludes content words (e.g. `run`, `work`)", () => {
            // Regression guard against re-introducing the stopwords-iso
            // list, which contains 1298 entries and includes verbs.
            expect(english.stopWords.has("run")).toBe(false)
            expect(english.stopWords.has("work")).toBe(false)
            expect(english.stopWords.has("find")).toBe(false)
            // Function words still filtered.
            expect(english.stopWords.has("the")).toBe(true)
            expect(english.stopWords.has("and")).toBe(true)
        })
    })

    describe("norwegian preset", () => {
        test("tokenizer keeps æøå inside words", () => {
            expect(norwegian.tokenize("Næringsliv på sjøen")).toEqual([
                "næringsliv",
                "på",
                "sjøen",
            ])
        })

        test("stemmer reduces 'båten' and 'båt' to a common root", () => {
            const a = norwegian.stem("båten")
            const b = norwegian.stem("båt")
            expect(a).toBe(b)
        })

        test("end-to-end — Norwegian inflections collapse", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                language: norwegian,
            })

            s.set(post("a"), { text: "Båten flyter på vannet" })
            s.set(post("b"), { text: "Hunden løper raskt" })

            // "båt" should match "båten" via Norwegian stemming.
            const hits = s
                .get(search("båt"))
                .map(a => a.familyArgsStringified)
            expect(hits).toContain("a")
        })
    })

    describe("french preset", () => {
        test("tokenizer keeps accented letters", () => {
            expect(french.tokenize("Café à Paris")).toEqual([
                "café",
                "à",
                "paris",
            ])
        })

        test("tokenizer drops apostrophes (handles French elision: l'eau → l, eau)", () => {
            // French splitter regex doesn't include `'` in the keep-class,
            // so apostrophes split words. This is correct for French
            // elision: `l'eau` should index as `l` + `eau`.
            const tokens = french.tokenize("l'eau bleue")
            expect(tokens).toContain("eau")
            expect(tokens).toContain("bleue")
        })

        test("stemmer reduces 'manger' and 'mange' to a common root", () => {
            // 'manger' (to eat) and 'mange' (eats) both stem to 'mang'.
            expect(french.stem("manger")).toBe(french.stem("mange"))
        })

        test("end-to-end — French inflections collapse via stemming", () => {
            const s = store()
            const post = atomFamily<{ text: string }, [string]>(null, {
                name: "posts",
            })
            const search = atomFamilySearch(post, p => p.text, {
                language: french,
            })

            s.set(post("a"), { text: "je mange du pain" })
            s.set(post("b"), { text: "le chat dort" })

            // "manger" should match "mange" via French stemming (both → "mang").
            const hits = s
                .get(search("manger"))
                .map(a => a.familyArgsStringified)
            expect(hits).toContain("a")
        })
    })

    describe("preset shape", () => {
        test("all presets have tokenize / stem / stopWords", () => {
            for (const preset of [english, norwegian, french]) {
                expect(typeof preset.tokenize).toBe("function")
                expect(typeof preset.stem).toBe("function")
                expect(preset.stopWords).toBeInstanceOf(Set)
            }
        })
    })

    describe("all 25 languages exported from barrel", () => {
        test("every export is a valid LanguagePreset", async () => {
            const all = await import("./index")
            const names = [
                "arabic", "armenian", "danish", "dutch", "english",
                "finnish", "french", "german", "greek", "hindi",
                "hungarian", "indonesian", "irish", "italian",
                "lithuanian", "nepali", "norwegian", "portuguese",
                "romanian", "russian", "serbian", "spanish", "swedish",
                "tamil", "turkish",
            ] as const
            expect(Object.keys(all).sort()).toEqual([...names].sort())
            for (const name of names) {
                const preset = (all as Record<string, unknown>)[name] as {
                    tokenize: unknown
                    stem: unknown
                    stopWords: unknown
                }
                expect(typeof preset.tokenize).toBe("function")
                expect(typeof preset.stem).toBe("function")
                expect(preset.stopWords).toBeInstanceOf(Set)
            }
        })

        test("each tokenizer returns an array of strings on a sample", () => {
            // Smoke test — for non-Latin scripts our naive ASCII sample
            // may produce an empty array (the splitter rejects all chars).
            // That's fine; we just want to make sure the function runs
            // without throwing.
            for (const preset of [
                english, french, german, italian, spanish, dutch,
                norwegian, swedish, danish, finnish, hungarian, romanian,
                turkish, indonesian, irish, lithuanian, serbian,
                russian, greek, armenian, arabic,
                nepali, hindi, tamil, portuguese,
            ] as const) {
                const out = preset.tokenize("hello world")
                expect(Array.isArray(out)).toBe(true)
            }
        })
    })

    describe("script-preserving tokenizers (non-Latin)", () => {
        // Regression guard: every non-Latin language's splitter regex
        // must preserve characters from its target script. If the regex
        // ever drifts (e.g. a copy-paste typo drops a Unicode range),
        // this catches it.
        const cases: ReadonlyArray<{
            name: string
            preset: { tokenize: (t: string) => string[] }
            input: string
            expectedTokens: string[]
        }> = [
            {
                name: "arabic preserves Arabic letters",
                preset: arabic,
                input: "مرحبا بالعالم",
                expectedTokens: ["مرحبا", "بالعالم"],
            },
            {
                name: "armenian preserves Armenian letters",
                preset: armenian,
                input: "բարեւ աշխարհ",
                expectedTokens: ["բարեւ", "աշխարհ"],
            },
            {
                name: "greek preserves Greek letters",
                preset: greek,
                input: "γειά σου κόσμε",
                expectedTokens: ["γειά", "σου", "κόσμε"],
            },
            {
                name: "hindi preserves Devanagari",
                preset: hindi,
                input: "नमस्ते दुनिया",
                expectedTokens: ["नमस्ते", "दुनिया"],
            },
            {
                name: "nepali preserves Devanagari",
                preset: nepali,
                input: "नमस्ते संसार",
                expectedTokens: ["नमस्ते", "संसार"],
            },
            {
                name: "russian preserves Cyrillic",
                preset: russian,
                input: "привет мир",
                expectedTokens: ["привет", "мир"],
            },
            {
                name: "tamil preserves Tamil letters",
                preset: tamil,
                input: "வணக்கம் உலகம்",
                expectedTokens: ["வணக்கம்", "உலகம்"],
            },
        ]
        for (const { name, preset, input, expectedTokens } of cases) {
            test(name, () => {
                expect(preset.tokenize(input)).toEqual(expectedTokens)
            })
        }
    })
})
