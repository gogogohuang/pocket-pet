import { test, expect } from 'claude-code/testing'

import { initialAnim, scene } from './anim'
import { adopt, createPet, setSpecies } from './pet'
import { SPECIES, listSpecies, parseSpecies, say, speciesOf } from './species'

test('ids and Chinese labels are both accepted; anything else is not', async () => {
  expect(parseSpecies('dog')?.id).toBe('dog')
  expect(parseSpecies(' BIRD ')?.id).toBe('bird')
  expect(parseSpecies('貓')?.id).toBe('cat')
  expect(parseSpecies('fish')).toBe(undefined)
  expect(listSpecies()).toContain('狗(dog)')
})

test('a record without a species, or with an unknown one, is a cat', async () => {
  expect(speciesOf({}).id).toBe('cat')
  expect(speciesOf({ species: 'gone' }).id).toBe('cat')
  expect(speciesOf({ species: 'bird' }).id).toBe('bird')
})

test('switching species changes only the species', async () => {
  const rec = createPet(1000, 'Gogo')

  expect(setSpecies(rec, 'dog')).toEqual({ ...rec, species: 'dog' })
})

test('each species draws a 3-row sprite that fits the room, and differs from the others', async () => {
  const drawn = Object.values(SPECIES).map(s => scene(initialAnim(), 'happy', '', 0, s.id).join('\n'))

  for (const text of drawn) expect(text.split('\n').every(l => l.length === 30)).toBe(true)
  expect(new Set(drawn).size).toBe(drawn.length)
  expect(scene(initialAnim(), 'happy')).toEqual(scene(initialAnim(), 'happy', '', 0, 'cat'))
})

test('helpers use the species look', async () => {
  expect(scene(initialAnim(), 'happy', '', 1, 'dog').join('\n')).toContain('U^')
})

test('shared cat text is reworded for dogs and birds, and left alone for cats', async () => {
  const text = 'Gogo 的貓砂盆該清了,蹭著你喵喵叫,吃完了呼嚕呼嚕。紙箱輕輕動了一下。'

  expect(say(SPECIES.cat, text)).toBe(text)
  expect(say(SPECIES.dog, text)).not.toMatch(/貓|喵|呼嚕/)
  expect(say(SPECIES.bird, text)).not.toMatch(/貓|喵|呼嚕|紙箱/)
})

test('adopting starts a fresh egg of the chosen species', async () => {
  const fresh = adopt(5000, 'dog', ' Rex ')

  expect(fresh).toMatchObject({ name: 'Rex', bornAt: 5000, species: 'dog', poopAt: [] })
  expect(fresh.personality).toBe(undefined)
  expect(adopt(5000, 'cat', '').species).toBe(undefined)
})
