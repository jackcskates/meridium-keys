import { describe, expect, it } from 'vitest'
import { unlockInputWarning } from './unlockInputDiagnostics'

describe('vault unlock input diagnostics', () => {
  it('does not alter or warn about ordinary byte-exact passwords', () => {
    expect(unlockInputWarning('Moon$River.4!5')).toBeNull()
  })

  it('identifies invisible pasted characters without displaying the secret', () => {
    expect(unlockInputWarning('Moon\u200BRiver')).toContain('invisible character')
  })

  it('identifies edge whitespace without trimming it', () => {
    expect(unlockInputWarning(' Moon$River ')).toContain('whitespace')
  })

  it('identifies visually equivalent but byte-different Unicode', () => {
    expect(unlockInputWarning('Cafe\u0301')).toContain('Unicode bytes')
  })
})
