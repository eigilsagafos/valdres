/** A list that carries at least one member. Commit work groups use it so "no
 *  work" has exactly ONE representation — `undefined`. An empty array can no
 *  longer masquerade as a group that must be settled, which is what made
 *  `deleted: []` and `unsetAtoms: []` behave differently for the same
 *  emptiness. */
export type NonEmpty<T> = [T, ...T[]]
