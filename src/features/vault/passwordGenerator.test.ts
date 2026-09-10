import { describe, expect, it } from 'vitest'
import { generatedPasswordLength, generateServicePassword } from './passwordGenerator'

describe('service password generator', () => {
  it('generates a 20-character password containing every required character class', () => {
    const password = generateServicePassword()

    expect(password).toHaveLength(generatedPasswordLength)
    expect(password).toMatch(/[a-z]/)
    expect(password).toMatch(/[A-Z]/)
    expect(password).toMatch(/[0-9]/)
    expect(password).toMatch(/[!@#$%^&*()\-_=+]/)
  })

  it('uses only the compatibility-focused character set', () => {
    for (let sample = 0; sample < 25; sample += 1) {
      expect(generateServicePassword()).toMatch(/^[A-Za-z0-9!@#$%^&*()\-_=+]{20}$/)
    }
  })
})
