const lowercase = 'abcdefghijklmnopqrstuvwxyz'
const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const numbers = '0123456789'
const symbols = '!@#$%^&*()-_=+'
const allowedCharacters = `${lowercase}${uppercase}${numbers}${symbols}`

export const generatedPasswordLength = 20

function secureIndex(upperBound: number) {
  const range = 0x1_0000_0000
  const acceptedLimit = range - (range % upperBound)
  const random = new Uint32Array(1)
  do crypto.getRandomValues(random)
  while (random[0] >= acceptedLimit)
  return random[0] % upperBound
}

function takeOne(characters: string) {
  return characters[secureIndex(characters.length)]
}

export function generateServicePassword() {
  const characters = [takeOne(lowercase), takeOne(uppercase), takeOne(numbers), takeOne(symbols)]
  while (characters.length < generatedPasswordLength) characters.push(takeOne(allowedCharacters))
  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = secureIndex(index + 1)
    const character = characters[index]
    characters[index] = characters[swapIndex]
    characters[swapIndex] = character
  }
  return characters.join('')
}
