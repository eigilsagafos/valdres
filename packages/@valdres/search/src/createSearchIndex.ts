import { atom } from "valdres"

/**
 * Generate trigrams (3-character chunks) from a string
 * Example: "hello" -> [" he", "hel", "ell", "llo", "lo "]
 */
const generateTrigrams = (str: string): Set<string> => {
    const trigrams = new Set<string>()
    const normalized = ` ${str.toLowerCase()} ` // Add padding for edge trigrams

    for (let i = 0; i < normalized.length - 2; i++) {
        trigrams.add(normalized.slice(i, i + 3))
    }

    return trigrams
}

/**
 * Calculate Levenshtein edit distance between two strings
 * with early exit optimization when distance exceeds maxDistance
 */
const levenshtein = (a: string, b: string, maxDistance: number): number => {
    const m = a.length
    const n = b.length

    // Early exit: length difference already exceeds max
    if (Math.abs(m - n) > maxDistance) return maxDistance + 1

    // Handle empty strings
    if (m === 0) return n
    if (n === 0) return m

    // Dynamic programming matrix (only need current and previous row)
    let prevRow = Array.from({ length: n + 1 }, (_, i) => i)
    let currRow = new Array(n + 1)

    for (let i = 1; i <= m; i++) {
        currRow[0] = i
        let minInRow = i // Track minimum value in row for early exit

        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            currRow[j] = Math.min(
                prevRow[j] + 1,        // deletion
                currRow[j - 1] + 1,    // insertion
                prevRow[j - 1] + cost  // substitution
            )

            minInRow = Math.min(minInRow, currRow[j])
        }

        // Early exit: entire row exceeds maxDistance
        if (minInRow > maxDistance) {
            return maxDistance + 1
        }

        // Swap rows for next iteration
        const temp = prevRow
        prevRow = currRow
        currRow = temp
    }

    return prevRow[n]
}

/**
 * Simple tokenizer: lowercase and split on non-alphanumeric characters
 */
const tokenize = (text: string): string[] => {
    if (!text) return []
    return text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(word => word.length > 0)
}

/**
 * Sleep helper for yielding to event loop
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Evaluate a single filter condition against a value
 */
const evaluateCondition = (condition: FilterCondition, atomValue: any): boolean => {
    const fieldValue = atomValue[condition.field]
    const testValue = condition.value
    const operator = condition.operator || 'equals'

    switch (operator) {
        case 'equals':
            return fieldValue === testValue

        case 'contains':
            if (Array.isArray(fieldValue)) {
                return fieldValue.includes(testValue)
            }
            if (typeof fieldValue === 'string') {
                return fieldValue.includes(testValue)
            }
            return false

        case 'startsWith':
            return typeof fieldValue === 'string' && fieldValue.startsWith(testValue)

        case 'endsWith':
            return typeof fieldValue === 'string' && fieldValue.endsWith(testValue)

        case 'gt':
            return fieldValue > testValue

        case 'gte':
            return fieldValue >= testValue

        case 'lt':
            return fieldValue < testValue

        case 'lte':
            return fieldValue <= testValue

        case 'in':
            return Array.isArray(testValue) && testValue.includes(fieldValue)

        default:
            return false
    }
}

/**
 * Check if a condition is a FilterGroup
 */
const isFilterGroup = (filter: FilterCondition | FilterGroup): filter is FilterGroup => {
    return 'operator' in filter && 'conditions' in filter
}

/**
 * Evaluate a filter (condition or group) against an atom value
 */
const evaluateFilter = (filter: FilterCondition | FilterGroup, atomValue: any): boolean => {
    if (isFilterGroup(filter)) {
        // Evaluate filter group
        if (filter.operator === 'AND') {
            return filter.conditions.every(condition => evaluateFilter(condition, atomValue))
        } else {
            // OR
            return filter.conditions.some(condition => evaluateFilter(condition, atomValue))
        }
    } else {
        // Evaluate single condition
        return evaluateCondition(filter, atomValue)
    }
}

/**
 * Apply sorting to search results
 */
const applySorting = (
    results: SearchResult[],
    sortConfig: SortConfig | SortConfig[] | undefined,
    store: any
): SearchResult[] => {
    if (!sortConfig) return results

    const sortConfigs = Array.isArray(sortConfig) ? sortConfig : [sortConfig]

    return results.sort((a, b) => {
        for (const config of sortConfigs) {
            const aValue = store.get(a.atom)[config.field]
            const bValue = store.get(b.atom)[config.field]
            const order = config.order || 'asc'

            // Handle undefined/null values (put them at the end)
            if (aValue == null && bValue == null) continue
            if (aValue == null) return 1
            if (bValue == null) return -1

            // Compare values
            let comparison = 0
            if (typeof aValue === 'string' && typeof bValue === 'string') {
                comparison = aValue.localeCompare(bValue)
            } else if (typeof aValue === 'number' && typeof bValue === 'number') {
                comparison = aValue - bValue
            } else if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
                comparison = (aValue === bValue) ? 0 : (aValue ? 1 : -1)
            } else {
                // Fallback: convert to string and compare
                comparison = String(aValue).localeCompare(String(bValue))
            }

            if (comparison !== 0) {
                return order === 'asc' ? comparison : -comparison
            }
        }
        return 0
    })
}

/**
 * Group search results by field value
 */
const applyGrouping = (
    results: SearchResult[],
    groupByConfig: string | GroupByConfig | undefined,
    store: any
): GroupedSearchResults | SearchResult[] => {
    if (!groupByConfig) return results

    const field = typeof groupByConfig === 'string' ? groupByConfig : groupByConfig.field
    const sortOrder = typeof groupByConfig === 'string' ? undefined : groupByConfig.sort

    // Group results by field value
    const groups: { [key: string]: SearchResult[] } = {}

    results.forEach(result => {
        const value = store.get(result.atom)[field]
        // Convert value to string for grouping key (handle null/undefined)
        const key = value == null ? '__null__' : String(value)

        if (!groups[key]) {
            groups[key] = []
        }
        groups[key].push(result)
    })

    // Sort group keys if specified
    if (sortOrder) {
        const sortedGroups: GroupedSearchResults = {}
        const keys = Object.keys(groups).sort((a, b) => {
            // Handle null group
            if (a === '__null__') return 1
            if (b === '__null__') return -1

            const comparison = a.localeCompare(b)
            return sortOrder === 'asc' ? comparison : -comparison
        })

        keys.forEach(key => {
            sortedGroups[key] = groups[key]
        })

        return sortedGroups
    }

    return groups
}

export type FilterCondition = {
    field: string
    value: any
    operator?: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'gt' | 'gte' | 'lt' | 'lte' | 'in'
}

export type FilterGroup = {
    operator: 'AND' | 'OR'
    conditions: (FilterCondition | FilterGroup)[]
}

export type SearchIndexConfig = {
    fields?: string[]
    extract?: (value: any) => string
    tolerance?: number
    batchSize?: number      // How many atoms to index per batch (default: 100)
    yieldInterval?: number  // Yield to event loop every N batches (default: 10)
}

export type SortConfig = {
    field: string
    order?: 'asc' | 'desc'  // Default: 'asc'
}

export type GroupByConfig = {
    field: string  // Field to group by
    sort?: 'asc' | 'desc'  // How to sort groups (by group key)
}

export type SearchOptions = {
    tolerance?: number
    limit?: number
    filter?: FilterGroup | FilterCondition  // Filter results by field values
    sort?: SortConfig | SortConfig[]  // Sort results by field(s)
    groupBy?: string | GroupByConfig  // Group results by field
}

export type SearchResult = {
    atom: any
    score: number
    matches: string[]
}

export type GroupedSearchResults = {
    [key: string]: SearchResult[]
}

export type SearchIndexStatus = {
    ready: boolean
    indexed: number
    total: number
    progress: number  // 0-1
}

export const createSearchIndex = (store: any, family: any, config: SearchIndexConfig = {}) => {
    const {
        fields = [],
        extract,
        tolerance: defaultTolerance = 1,
        batchSize = 100,
        yieldInterval = 10
    } = config

    // Version atom: increments whenever index changes
    // This allows selectors to subscribe to index changes without subscribing to all atoms
    const versionAtom = atom(0)

    // Inverted index: word -> Set of atom IDs that contain this word
    const wordIndex = new Map<string, Set<string>>()

    // Trigram index: trigram -> Set of words containing this trigram
    const trigramIndex = new Map<string, Set<string>>()

    // Track indexed atoms: atomId -> Set of words we indexed from this atom
    const atomToWords = new Map<string, Set<string>>()

    // Indexing state
    let isIndexing = false
    let indexReady = false
    let totalAtoms = 0
    let indexedAtoms = 0
    const pendingIndexQueue: Array<{ atomId: string; value: any }> = []
    let indexingPromise: Promise<void> | null = null

    /**
     * Extract searchable text from atom value
     */
    const extractText = (value: any): string => {
        if (extract) return extract(value)
        if (fields.length > 0) {
            return fields.map(f => value?.[f]).filter(Boolean).join(' ')
        }
        // Fallback: stringify entire value
        return typeof value === 'string' ? value : JSON.stringify(value)
    }

    /**
     * Add a word to the trigram index
     */
    const indexWordTrigrams = (word: string) => {
        // Skip if already indexed
        if (trigramIndex.has(`__word:${word}`)) return

        const trigrams = generateTrigrams(word)
        trigrams.forEach(trigram => {
            if (!trigramIndex.has(trigram)) {
                trigramIndex.set(trigram, new Set())
            }
            trigramIndex.get(trigram)!.add(word)
        })

        // Mark this word as indexed
        trigramIndex.set(`__word:${word}`, new Set())
    }

    /**
     * Add an atom to the search index (synchronous core operation)
     */
    const indexAtomSync = (atomId: string, value: any) => {
        const text = extractText(value)
        const words = tokenize(text)

        // Remove old index entries for this atom
        const oldWords = atomToWords.get(atomId)
        if (oldWords) {
            oldWords.forEach(word => {
                const atomIds = wordIndex.get(word)
                if (atomIds) {
                    atomIds.delete(atomId)
                    // Clean up empty entries
                    if (atomIds.size === 0) {
                        wordIndex.delete(word)
                    }
                }
            })
        }

        // Add new index entries
        const newWords = new Set<string>()
        words.forEach(word => {
            // Add to word -> atoms mapping
            if (!wordIndex.has(word)) {
                wordIndex.set(word, new Set())
            }
            wordIndex.get(word)!.add(atomId)

            // Add word to trigram index
            indexWordTrigrams(word)

            newWords.add(word)
        })

        atomToWords.set(atomId, newWords)

        // Increment version to notify subscribers
        store.set(versionAtom, store.get(versionAtom) + 1)
    }

    /**
     * Remove an atom from the search index
     */
    const removeAtom = (atomId: string) => {
        const words = atomToWords.get(atomId)
        if (!words) return

        words.forEach(word => {
            const atomIds = wordIndex.get(word)
            if (atomIds) {
                atomIds.delete(atomId)
                if (atomIds.size === 0) {
                    wordIndex.delete(word)
                }
            }
        })

        atomToWords.delete(atomId)

        // Increment version to notify subscribers
        store.set(versionAtom, store.get(versionAtom) + 1)
    }

    /**
     * Process the indexing queue in batches
     */
    const processIndexQueue = async () => {
        if (isIndexing || pendingIndexQueue.length === 0) return

        isIndexing = true
        let batchCount = 0

        while (pendingIndexQueue.length > 0) {
            // Process a batch
            const batch = pendingIndexQueue.splice(0, batchSize)

            for (const { atomId, value } of batch) {
                indexAtomSync(atomId, value)
                indexedAtoms++
            }

            batchCount++

            // Yield to event loop every N batches
            if (batchCount % yieldInterval === 0) {
                await sleep(0) // Yield to event loop
            }
        }

        isIndexing = false
        indexReady = true
    }

    /**
     * Queue an atom for indexing
     */
    const queueAtomForIndexing = (atomId: string, value: any) => {
        pendingIndexQueue.push({ atomId, value })

        // Start processing if not already running
        if (!indexingPromise) {
            indexingPromise = processIndexQueue().then(() => {
                indexingPromise = null
            })
        }
    }

    /**
     * Initial indexing: queue all existing atoms
     */
    const initializeIndex = async () => {
        const allAtoms = store.get(family)
        totalAtoms = allAtoms.length
        indexedAtoms = 0

        // Queue all atoms for indexing
        allAtoms.forEach((atom: any) => {
            const atomId = JSON.stringify(atom.familyArgs)
            const value = store.get(atom)
            queueAtomForIndexing(atomId, value)
        })

        // Wait for initial indexing to complete
        await indexingPromise
    }

    /**
     * Subscribe to family changes to keep index updated
     * Important: Subscribe AFTER we've captured the initial set
     */
    const unsubscribe = store.sub(family, (...familyArgs: any[]) => {
        const atom = family(...familyArgs)
        const atomId = JSON.stringify(familyArgs)

        try {
            const value = store.get(atom)

            // If initial indexing is done, index immediately (it's just one atom)
            // Otherwise queue it for batched processing
            if (indexReady) {
                indexAtomSync(atomId, value)
            } else {
                // During initial indexing, queue new atoms
                totalAtoms++
                queueAtomForIndexing(atomId, value)
            }
        } catch (e) {
            // Atom was deleted or not accessible
            removeAtom(atomId)
            if (!indexReady) {
                totalAtoms = Math.max(0, totalAtoms - 1)
            }
        }
    })

    // Start initial indexing (don't await - let it happen in background)
    const initPromise = initializeIndex()

    /**
     * Wait for index to be ready
     */
    const waitForReady = async () => {
        await initPromise
        while (isIndexing) {
            await sleep(10)
        }
    }

    /**
     * Search the index using hybrid trigram + Levenshtein approach
     */
    const search = async (query: string, options: SearchOptions = {}): Promise<SearchResult[]> => {
        // Wait for index to be ready
        await waitForReady()

        const maxEdits = options.tolerance ?? defaultTolerance
        const limit = options.limit

        const queryWords = tokenize(query)

        // If no query but has filter, return all atoms (filter will be applied later)
        if (queryWords.length === 0 && options.filter) {
            const allAtoms = store.get(family)
            let results = allAtoms.map((atom: any) => ({
                atom,
                score: 1,
                matches: [] as string[]
            }))

            // Apply filters
            results = results.filter((result: SearchResult) => {
                const atomValue = store.get(result.atom)
                return evaluateFilter(options.filter!, atomValue)
            })

            // Apply limit
            return limit ? results.slice(0, limit) : results
        }

        if (queryWords.length === 0) return []

        // Track results: atomId -> { score, matches }
        const results = new Map<string, { minDistance: number, matches: Set<string> }>()

        queryWords.forEach(queryWord => {
            // For very short queries (1-2 chars), use prefix matching instead of trigrams
            if (queryWord.length < 3) {
                // Prefix search: check all indexed words
                wordIndex.forEach((atomIds, indexedWord) => {
                    // Check if indexed word starts with query
                    if (indexedWord.startsWith(queryWord)) {
                        const distance = 0 // Exact prefix match

                        // Add all atoms containing this word
                        atomIds.forEach(atomId => {
                            const existing = results.get(atomId)
                            if (!existing || distance < existing.minDistance) {
                                results.set(atomId, {
                                    minDistance: distance,
                                    matches: new Set([indexedWord])
                                })
                            } else if (distance === existing.minDistance) {
                                existing.matches.add(indexedWord)
                            }
                        })
                    }
                })
                return // Skip trigram search for short queries
            }

            // PHASE 1: Find candidate words using trigram index (for queries >= 3 chars)
            const queryTrigrams = generateTrigrams(queryWord)
            const candidateWords = new Set<string>()

            queryTrigrams.forEach(trigram => {
                const words = trigramIndex.get(trigram)
                if (words) {
                    words.forEach(word => candidateWords.add(word))
                }
            })

            // PHASE 2: Score candidates with Levenshtein distance
            candidateWords.forEach(candidateWord => {
                // Check if query is a substring (exact match gets distance 0)
                const isSubstring = candidateWord.includes(queryWord)
                const distance = isSubstring ? 0 : levenshtein(queryWord, candidateWord, maxEdits)

                if (distance <= maxEdits) {
                    // This word matches! Find all atoms containing it
                    const atomIds = wordIndex.get(candidateWord)
                    if (atomIds) {
                        atomIds.forEach(atomId => {
                            const existing = results.get(atomId)
                            if (!existing) {
                                results.set(atomId, {
                                    minDistance: distance,
                                    matches: new Set([candidateWord])
                                })
                            } else {
                                // Update if this is a better match
                                if (distance < existing.minDistance) {
                                    existing.minDistance = distance
                                }
                                existing.matches.add(candidateWord)
                            }
                        })
                    }
                }
            })
        })

        // Convert results to array and sort by score
        let sortedResults = Array.from(results.entries())
            .map(([atomId, data]) => {
                const familyArgs = JSON.parse(atomId)
                const atom = family(...familyArgs)

                // Score: lower distance = higher score
                // Normalize to 0-1 range where 1 is perfect match
                const score = 1 - (data.minDistance / (maxEdits + 1))

                return {
                    atom,
                    score,
                    matches: Array.from(data.matches)
                }
            })
            .sort((a, b) => b.score - a.score) // Sort by score descending

        // Apply filters if specified
        if (options.filter) {
            sortedResults = sortedResults.filter(result => {
                const atomValue = store.get(result.atom)
                return evaluateFilter(options.filter!, atomValue)
            })
        }

        // Apply sorting if specified (otherwise results are sorted by score)
        if (options.sort) {
            sortedResults = applySorting(sortedResults, options.sort, store)
        }

        // Apply limit if specified (before grouping)
        if (limit && !options.groupBy) {
            sortedResults = sortedResults.slice(0, limit)
        }

        // Apply grouping if specified
        if (options.groupBy) {
            return applyGrouping(sortedResults, options.groupBy, store) as any
        }

        return sortedResults
    }

    /**
     * Synchronous search (returns empty if not ready)
     */
    const searchSync = (query: string, options: SearchOptions = {}): SearchResult[] => {
        if (!indexReady) return []

        const maxEdits = options.tolerance ?? defaultTolerance
        const limit = options.limit

        const queryWords = tokenize(query)

        // If no query but has filter, return all atoms (filter will be applied later)
        if (queryWords.length === 0 && options.filter) {
            const allAtoms = store.get(family)
            let results = allAtoms.map((atom: any) => ({
                atom,
                score: 1,
                matches: [] as string[]
            }))

            // Apply filters
            results = results.filter((result: SearchResult) => {
                const atomValue = store.get(result.atom)
                return evaluateFilter(options.filter!, atomValue)
            })

            // Apply limit
            return limit ? results.slice(0, limit) : results
        }

        if (queryWords.length === 0) return []

        // Same logic as async search but synchronous
        const results = new Map<string, { minDistance: number, matches: Set<string> }>()

        queryWords.forEach(queryWord => {
            // For very short queries (1-2 chars), use prefix matching instead of trigrams
            if (queryWord.length < 3) {
                // Prefix search: check all indexed words
                wordIndex.forEach((atomIds, indexedWord) => {
                    // Check if indexed word starts with query
                    if (indexedWord.startsWith(queryWord)) {
                        const distance = 0 // Exact prefix match

                        // Add all atoms containing this word
                        atomIds.forEach(atomId => {
                            const existing = results.get(atomId)
                            if (!existing || distance < existing.minDistance) {
                                results.set(atomId, {
                                    minDistance: distance,
                                    matches: new Set([indexedWord])
                                })
                            } else if (distance === existing.minDistance) {
                                existing.matches.add(indexedWord)
                            }
                        })
                    }
                })
                return // Skip trigram search for short queries
            }

            const queryTrigrams = generateTrigrams(queryWord)
            const candidateWords = new Set<string>()

            queryTrigrams.forEach(trigram => {
                const words = trigramIndex.get(trigram)
                if (words) {
                    words.forEach(word => candidateWords.add(word))
                }
            })

            candidateWords.forEach(candidateWord => {
                // Check if query is a substring (exact match gets distance 0)
                const isSubstring = candidateWord.includes(queryWord)
                const distance = isSubstring ? 0 : levenshtein(queryWord, candidateWord, maxEdits)

                if (distance <= maxEdits) {
                    const atomIds = wordIndex.get(candidateWord)
                    if (atomIds) {
                        atomIds.forEach(atomId => {
                            const existing = results.get(atomId)
                            if (!existing) {
                                results.set(atomId, {
                                    minDistance: distance,
                                    matches: new Set([candidateWord])
                                })
                            } else {
                                if (distance < existing.minDistance) {
                                    existing.minDistance = distance
                                }
                                existing.matches.add(candidateWord)
                            }
                        })
                    }
                }
            })
        })

        let sortedResults = Array.from(results.entries())
            .map(([atomId, data]) => {
                const familyArgs = JSON.parse(atomId)
                const atom = family(...familyArgs)
                const score = 1 - (data.minDistance / (maxEdits + 1))

                return {
                    atom,
                    score,
                    matches: Array.from(data.matches)
                }
            })
            .sort((a, b) => b.score - a.score)

        // Apply filters if specified
        if (options.filter) {
            sortedResults = sortedResults.filter(result => {
                const atomValue = store.get(result.atom)
                return evaluateFilter(options.filter!, atomValue)
            })
        }

        // Apply sorting if specified (otherwise results are sorted by score)
        if (options.sort) {
            sortedResults = applySorting(sortedResults, options.sort, store)
        }

        // Apply limit if specified (before grouping)
        if (limit && !options.groupBy) {
            sortedResults = sortedResults.slice(0, limit)
        }

        // Apply grouping if specified
        if (options.groupBy) {
            return applyGrouping(sortedResults, options.groupBy, store) as any
        }

        return sortedResults
    }

    /**
     * Get current indexing status
     */
    const getStatus = (): SearchIndexStatus => {
        return {
            ready: indexReady,
            indexed: indexedAtoms,
            total: totalAtoms,
            progress: totalAtoms > 0 ? indexedAtoms / totalAtoms : 0
        }
    }

    return {
        search,           // Async search (waits for index)
        searchSync,       // Sync search (returns empty if not ready)
        getStatus,        // Get indexing progress
        waitForReady,     // Wait for initial indexing to complete
        getVersionAtom: () => versionAtom,  // Get version atom for reactive subscriptions
        unsubscribe,

        // Debug/inspection methods
        _getStats: () => ({
            indexedWords: wordIndex.size,
            indexedAtoms: atomToWords.size,
            trigramCount: trigramIndex.size
        }),
        _getWordIndex: () => wordIndex,
        _getTrigramIndex: () => trigramIndex
    }
}
