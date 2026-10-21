// Adapted from pmndrs/jotai v3.0.1 tests/vanilla/utils/atomWithRefresh.test.ts (MIT). See ../../UPSTREAM.md.
import { describe, expect, it } from '../../../vi'
import { createStore } from '../../../impl'
import { atomWithRefresh } from 'jotai-reference/vanilla/utils'

describe('atomWithRefresh', () => {
  it('[DEV-ONLY] throws when refresh is called with extra arguments', () => {
    const atom = atomWithRefresh(() => {})
    const store = createStore()
    const args = ['some arg'] as unknown as []
    expect(() => store.set(atom, ...args)).throws()
  })
})
