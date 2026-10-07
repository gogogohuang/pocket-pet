// Pet personalities: plain data, one row per preset. Pure; nothing here touches `$`.
// `normal` is the cat as it was before personalities existed and must stay that way.

export type PersonalityId = 'normal' | 'playful' | 'lazy' | 'curious' | 'aloof' | 'clingy'

/** Relative weight of each idle action when the cat picks what to do next. */
export type Weights = {
  walk: number
  jump: number
  groom: number
  stretch: number
  scratch: number
  yawn: number
  roll: number
  crouch: number
  spin: number
  sit: number
}

export type Lines = {
  hungry: (name: string) => string
  dirty: (name: string) => string
  woke: (name: string) => string
  goodbye: (name: string) => string
  fed: (name: string) => string
  played: (name: string) => string
  cleaned: (name: string) => string
}

export type Personality = {
  id: PersonalityId
  label: string
  blurb: string
  weights: Weights
  /** Cells per walking frame (1 or 2), and how many frames pass per step (1 or 2). */
  stride: 1 | 2
  skip: 1 | 2
  /** A walking cat heads for the middle of the room and stays near it. */
  centered: boolean
  /** How long Claude has to be busy before the cat dozes off. */
  dozeAfterMs: number
  /** Frames the cat keeps watching after the last keystroke; 0 ignores typing. */
  watchFrames: number
  /** How long it celebrates a finished turn, and how long it stays startled. */
  celebrateMs: number
  startleMs: number
  /** Frames before the cat reacts to a change in what Claude is doing. */
  lagFrames: number
  /** Multipliers on how fast hunger and boredom grow. */
  hungerRate: number
  boredRate: number
  lines: Lines
}

const normalLines: Lines = {
  hungry: n => `${n} 餓了!`,
  dirty: n => `${n} 的貓砂盆該清了`,
  woke: n => `${n} 睡醒了`,
  goodbye: n => `${n} 揮手說掰掰 👋`,
  fed: n => `${n} 呼嚕呼嚕地吃光了!`,
  played: n => `${n} 追著逗貓棒跑,好開心!`,
  cleaned: () => '貓砂盆清乾淨了 ✨',
}

export const PERSONALITIES: Record<PersonalityId, Personality> = {
  normal: {
    id: 'normal',
    label: '普通',
    blurb: '原本的樣子',
    weights: { walk: 30, jump: 10, groom: 10, stretch: 8, scratch: 8, yawn: 8, roll: 6, crouch: 6, spin: 6, sit: 8 },
    stride: 1,
    skip: 1,
    centered: false,
    dozeAfterMs: 120_000,
    watchFrames: 4,
    celebrateMs: 4000,
    startleMs: 2500,
    lagFrames: 0,
    hungerRate: 1,
    boredRate: 1,
    lines: normalLines,
  },
  playful: {
    id: 'playful',
    label: '活潑',
    blurb: '跑跳不停,很快就無聊',
    weights: { walk: 28, jump: 22, groom: 4, stretch: 4, scratch: 4, yawn: 2, roll: 8, crouch: 10, spin: 14, sit: 4 },
    stride: 2,
    skip: 1,
    centered: false,
    dozeAfterMs: 180_000,
    watchFrames: 6,
    celebrateMs: 6000,
    startleMs: 1500,
    lagFrames: 0,
    hungerRate: 1.2,
    boredRate: 1.6,
    lines: {
      ...normalLines,
      hungry: n => `${n} 餓扁了,快來餵牠!`,
      woke: n => `${n} 睡醒了,精神百倍!`,
      played: n => `${n} 衝來衝去,還想再玩!`,
    },
  },
  lazy: {
    id: 'lazy',
    label: '慵懶',
    blurb: '愛坐著打盹,不容易餓',
    weights: { walk: 12, jump: 3, groom: 14, stretch: 14, scratch: 6, yawn: 18, roll: 6, crouch: 2, spin: 1, sit: 24 },
    stride: 1,
    skip: 2,
    centered: false,
    dozeAfterMs: 60_000,
    watchFrames: 2,
    celebrateMs: 2000,
    startleMs: 2500,
    lagFrames: 0,
    hungerRate: 0.7,
    boredRate: 0.7,
    lines: {
      ...normalLines,
      hungry: n => `${n} 懶懶地瞄了空碗一眼……`,
      woke: n => `${n} 伸了個大懶腰,醒了`,
      fed: n => `${n} 慢吞吞地把飯吃完了。`,
      played: n => `${n} 陪你玩了一下就想躺平。`,
    },
  },
  curious: {
    id: 'curious',
    label: '好奇',
    blurb: '什麼都想看一眼',
    weights: { walk: 40, jump: 8, groom: 6, stretch: 6, scratch: 6, yawn: 4, roll: 6, crouch: 10, spin: 4, sit: 10 },
    stride: 1,
    skip: 1,
    centered: false,
    dozeAfterMs: 150_000,
    watchFrames: 8,
    celebrateMs: 4000,
    startleMs: 2500,
    lagFrames: 0,
    hungerRate: 1,
    boredRate: 1.2,
    lines: {
      ...normalLines,
      hungry: n => `${n} 在空碗旁邊東聞西聞,好像餓了`,
      played: n => `${n} 盯著逗貓棒研究了好久,然後撲上去!`,
    },
  },
  aloof: {
    id: 'aloof',
    label: '傲嬌',
    blurb: '裝作不在意,反應慢半拍',
    weights: { walk: 20, jump: 4, groom: 28, stretch: 10, scratch: 8, yawn: 8, roll: 2, crouch: 4, spin: 2, sit: 14 },
    stride: 1,
    skip: 1,
    centered: false,
    dozeAfterMs: 90_000,
    watchFrames: 0,
    celebrateMs: 2500,
    startleMs: 2500,
    lagFrames: 4,
    hungerRate: 0.9,
    boredRate: 0.8,
    lines: {
      hungry: n => `${n} 才不是餓了,只是剛好路過碗邊`,
      dirty: n => `${n} 瞥了貓砂盆一眼,別開頭`,
      woke: n => `${n} 醒了,哼。`,
      goodbye: n => `${n} 頭也不回地走了`,
      fed: n => `${n} 勉強吃了,才不是因為好吃。`,
      played: n => `${n} 說:「就陪你玩一下而已。」`,
      cleaned: () => '貓砂盆乾淨了,貓裝作沒看見 ✨',
    },
  },
  clingy: {
    id: 'clingy',
    label: '黏人',
    blurb: '愛待在中間,最愛你',
    weights: { walk: 26, jump: 10, groom: 6, stretch: 6, scratch: 4, yawn: 4, roll: 14, crouch: 6, spin: 14, sit: 10 },
    stride: 1,
    skip: 1,
    centered: true,
    dozeAfterMs: 150_000,
    watchFrames: 10,
    celebrateMs: 7000,
    startleMs: 3500,
    lagFrames: 0,
    hungerRate: 1.1,
    boredRate: 1.5,
    lines: {
      ...normalLines,
      hungry: n => `${n} 蹭著你喵喵叫,肚子餓了`,
      woke: n => `${n} 醒了,第一件事是找你`,
      goodbye: n => `${n} 捨不得你走,揮手揮好久 👋`,
      played: n => `${n} 玩得好開心,一直黏著你!`,
    },
  },
}

export const DEFAULT_PERSONALITY: Personality = PERSONALITIES.normal

/** The personality a record has; absent or unknown means `normal`. */
export const personalityOf = (rec: { personality?: string }): Personality =>
  PERSONALITIES[(rec.personality ?? 'normal') as PersonalityId] ?? DEFAULT_PERSONALITY

/** Accepts an id (any case) or the Chinese label. */
export const parsePersonality = (text: string): Personality | undefined => {
  const t = text.trim().toLowerCase()

  return Object.values(PERSONALITIES).find(p => p.id === t || p.label === t)
}

export const listPersonalities = (): string =>
  Object.values(PERSONALITIES)
    .map(p => `${p.label}(${p.id}):${p.blurb}`)
    .join('\n')
