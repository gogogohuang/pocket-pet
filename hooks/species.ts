// Pet species: plain data, one row per kind. Pure. Species only changes how the pet looks and what
// it is called; how it behaves is the personality's job. `cat` is the pet as it was before species
// existed and must stay that way.

export type SpeciesId = 'cat' | 'dog' | 'bird'

export type Species = {
  id: SpeciesId
  label: string
  blurb: string
  /** The name a newly adopted one starts with. */
  defaultName: string
  /** What the pane calls it at each stage. */
  stageNames: { egg: string; baby: string; adult: string }
  /** The status-line icon. */
  icon: { egg: string; asleep: string; happy: string; sad: string; normal: string }
  /** What the pet's helpers (one per running subagent) look like, two frames. */
  helper: [string, string]
  /** The egg stage: what it hatches from. */
  egg: string[]
  /** Cat words in the shared text, swapped for this species' own. The cat itself needs none. */
  words: [string, string][]
}

const box = ['  _______  ', ' |       | ', ' | 紙 箱 | ', ' |_______| ']

export const SPECIES: Record<SpeciesId, Species> = {
  cat: {
    id: 'cat',
    label: '貓',
    defaultName: '小貓',
    blurb: '會梳毛、伸懶腰、撲球',
    stageNames: { egg: '紙箱裡', baby: '幼貓', adult: '成貓' },
    icon: { egg: '📦', asleep: '😴', happy: '😺', sad: '😿', normal: '🐱' },
    helper: ['=^o^=', '=^.^='],
    egg: box,
    words: [],
  },
  dog: {
    id: 'dog',
    label: '狗',
    defaultName: '小狗',
    blurb: '垂耳朵、搖尾巴',
    stageNames: { egg: '紙箱裡', baby: '幼犬', adult: '成犬' },
    icon: { egg: '📦', asleep: '😴', happy: '🐶', sad: '🐕', normal: '🐕' },
    helper: ['U^o^U', 'U^.^U'],
    egg: box,
    words: [['貓砂盆', '便盆'], ['逗貓棒', '球'], ['呼嚕呼嚕', '狼吞虎嚥'], ['喵喵', '汪汪'], ['喵~', '汪~'], ['貓', '狗']],
  },
  bird: {
    id: 'bird',
    label: '鳥',
    defaultName: '小鳥',
    blurb: '頭上一撮毛,走起路來一跳一跳',
    stageNames: { egg: '蛋裡', baby: '雛鳥', adult: '成鳥' },
    icon: { egg: '🥚', asleep: '😴', happy: '🐥', sad: '🐦', normal: '🐦' },
    helper: [' (o> ', ' (.> '],
    egg: ['   ___   ', '  /   \\  ', ' |  蛋  | ', '  \\___/  '],
    words: [['貓砂盆', '鳥籠'], ['逗貓棒', '小鈴鐺'], ['呼嚕呼嚕', '啾啾'], ['喵喵', '啾啾'], ['喵~', '啾~'], ['紙箱', '蛋'], ['貓', '鳥']],
  },
}

export const DEFAULT_SPECIES: Species = SPECIES.cat

/** The species a record has; absent or unknown means `cat`. */
export const speciesOf = (rec: { species?: string }): Species =>
  SPECIES[(rec.species ?? 'cat') as SpeciesId] ?? DEFAULT_SPECIES

/** Accepts an id (any case) or the Chinese label. */
export const parseSpecies = (text: string): Species | undefined => {
  const t = text.trim().toLowerCase()

  return Object.values(SPECIES).find(s => s.id === t || s.label === t)
}

export const listSpecies = (): string =>
  Object.values(SPECIES)
    .map(s => `${s.label}(${s.id}):${s.blurb}`)
    .join('\n')

/** The shared messages are written for a cat; this makes them fit the species. */
export const say = (species: Species, text: string): string =>
  species.words.reduce((t, [from, to]) => t.replaceAll(from, to), text)
