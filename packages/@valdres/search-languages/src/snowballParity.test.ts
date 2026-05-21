import { describe, expect, test } from "bun:test"

import { pairs as armenianPairs } from "../test/fixtures/armenian"
import { pairs as danishPairs } from "../test/fixtures/danish"
import { pairs as dutchPairs } from "../test/fixtures/dutch"
import { pairs as englishPairs } from "../test/fixtures/english"
import { pairs as finnishPairs } from "../test/fixtures/finnish"
import { pairs as frenchPairs } from "../test/fixtures/french"
import { pairs as germanPairs } from "../test/fixtures/german"
import { pairs as greekPairs } from "../test/fixtures/greek"
import { pairs as hindiPairs } from "../test/fixtures/hindi"
import { pairs as hungarianPairs } from "../test/fixtures/hungarian"
import { pairs as indonesianPairs } from "../test/fixtures/indonesian"
import { pairs as irishPairs } from "../test/fixtures/irish"
import { pairs as italianPairs } from "../test/fixtures/italian"
import { pairs as lithuanianPairs } from "../test/fixtures/lithuanian"
import { pairs as nepaliPairs } from "../test/fixtures/nepali"
import { pairs as norwegianPairs } from "../test/fixtures/norwegian"
import { pairs as portuguesePairs } from "../test/fixtures/portuguese"
import { pairs as romanianPairs } from "../test/fixtures/romanian"
import { pairs as russianPairs } from "../test/fixtures/russian"
import { pairs as serbianPairs } from "../test/fixtures/serbian"
import { pairs as spanishPairs } from "../test/fixtures/spanish"
import { pairs as swedishPairs } from "../test/fixtures/swedish"
import { pairs as tamilPairs } from "../test/fixtures/tamil"
import { pairs as turkishPairs } from "../test/fixtures/turkish"

import { stem as armenianStem } from "./stemmers/armenian"
import { stem as danishStem } from "./stemmers/danish"
import { stem as dutchStem } from "./stemmers/dutch"
import { stem as englishStem } from "./stemmers/english"
import { stem as finnishStem } from "./stemmers/finnish"
import { stem as frenchStem } from "./stemmers/french"
import { stem as germanStem } from "./stemmers/german"
import { stem as greekStem } from "./stemmers/greek"
import { stem as hindiStem } from "./stemmers/hindi"
import { stem as hungarianStem } from "./stemmers/hungarian"
import { stem as indonesianStem } from "./stemmers/indonesian"
import { stem as irishStem } from "./stemmers/irish"
import { stem as italianStem } from "./stemmers/italian"
import { stem as lithuanianStem } from "./stemmers/lithuanian"
import { stem as nepaliStem } from "./stemmers/nepali"
import { stem as norwegianStem } from "./stemmers/norwegian"
import { stem as portugueseStem } from "./stemmers/portuguese"
import { stem as romanianStem } from "./stemmers/romanian"
import { stem as russianStem } from "./stemmers/russian"
import { stem as serbianStem } from "./stemmers/serbian"
import { stem as spanishStem } from "./stemmers/spanish"
import { stem as swedishStem } from "./stemmers/swedish"
import { stem as tamilStem } from "./stemmers/tamil"
import { stem as turkishStem } from "./stemmers/turkish"

/** One stemmer per language we ship a fixture for. Arabic is
 *  intentionally absent: snowball-data has no `voc.txt`/`output.txt`
 *  for it, so we can't generate a parity fixture. The Arabic stemmer
 *  is still smoke-tested via `searchLanguages.test.ts` (tokenizer
 *  preserves Arabic letters; the stemmer runs without throwing). If
 *  upstream adds Arabic test data, regenerate fixtures via
 *  `bun run build:fixtures` and add `arabic` to the SUITES table.
 *
 *  When this test fails for a single language, the failure message
 *  identifies which (input, expected) pair drifted, so a regression in
 *  the build pipeline points straight at the culprit. */
const SUITES: ReadonlyArray<{
    name: string
    stem: (word: string) => string
    pairs: ReadonlyArray<readonly [string, string]>
}> = [
    { name: "armenian",   stem: armenianStem,   pairs: armenianPairs   },
    { name: "danish",     stem: danishStem,     pairs: danishPairs     },
    { name: "dutch",      stem: dutchStem,      pairs: dutchPairs      },
    { name: "english",    stem: englishStem,    pairs: englishPairs    },
    { name: "finnish",    stem: finnishStem,    pairs: finnishPairs    },
    { name: "french",     stem: frenchStem,     pairs: frenchPairs     },
    { name: "german",     stem: germanStem,     pairs: germanPairs     },
    { name: "greek",      stem: greekStem,      pairs: greekPairs      },
    { name: "hindi",      stem: hindiStem,      pairs: hindiPairs      },
    { name: "hungarian",  stem: hungarianStem,  pairs: hungarianPairs  },
    { name: "indonesian", stem: indonesianStem, pairs: indonesianPairs },
    { name: "irish",      stem: irishStem,      pairs: irishPairs      },
    { name: "italian",    stem: italianStem,    pairs: italianPairs    },
    { name: "lithuanian", stem: lithuanianStem, pairs: lithuanianPairs },
    { name: "nepali",     stem: nepaliStem,     pairs: nepaliPairs     },
    { name: "norwegian",  stem: norwegianStem,  pairs: norwegianPairs  },
    { name: "portuguese", stem: portugueseStem, pairs: portuguesePairs },
    { name: "romanian",   stem: romanianStem,   pairs: romanianPairs   },
    { name: "russian",    stem: russianStem,    pairs: russianPairs    },
    { name: "serbian",    stem: serbianStem,    pairs: serbianPairs    },
    { name: "spanish",    stem: spanishStem,    pairs: spanishPairs    },
    { name: "swedish",    stem: swedishStem,    pairs: swedishPairs    },
    { name: "tamil",      stem: tamilStem,      pairs: tamilPairs      },
    { name: "turkish",    stem: turkishStem,    pairs: turkishPairs    },
]

describe("Snowball parity — generated stemmers match upstream reference output", () => {
    for (const { name, stem, pairs } of SUITES) {
        test(`${name}: ${pairs.length} reference pairs`, () => {
            const failures: string[] = []
            for (const [input, expected] of pairs) {
                const actual = stem(input)
                if (actual !== expected) {
                    failures.push(
                        `  stem(${JSON.stringify(input)}) = ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
                    )
                }
            }
            // One assertion that lists every drift for a clear repro.
            expect(failures.join("\n")).toBe("")
        })
    }
})
