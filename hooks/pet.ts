import { personalityOf } from './personality'
import type { PersonalityId } from './personality'

// Pure pet logic. The pet is stored as timestamps and meters, never as
// "current" values; computePet(record, now) derives how it is right now, so
// the time a session was closed is accounted for on the next open.

const HOUR = 3_600_000
const MAX_LEVEL = 5
const SLEEP_WEIGHT = 0.25 // meters creep at a quarter speed while asleep
const MAX_LOOKBACK = 14 * 24 * HOUR
const HUNGER_UNIT = 4 * HOUR // one hunger level per 4 awake hours
const BORED_UNIT = 3 * HOUR
const POOP_DELAY = 90 * 60_000
const EGG_MS = 10 * 60_000
const BABY_MS = 3 * 24 * HOUR

/** A meter keeps `ms` of accumulated need as of `at`; time adds to it. */
export type Meter = { ms: number; at: number }

export type PetRecord = {
  name: string
  bornAt: number
  hunger: Meter
  bored: Meter
  /** When each unclean spot appears; those at or before now are mess. */
  poopAt: number[]
  /** Absent means 'normal'. */
  personality?: PersonalityId
}

export type Stage = 'egg' | 'baby' | 'adult'
export type Mood = 'sleeping' | 'starving' | 'dirty' | 'sad' | 'hungry' | 'happy'

export type PetView = {
  name: string
  stage: Stage
  /** 0 (full) to 5 (starving) */
  hunger: number
  /** 0 (bored) to 5 (delighted) */
  happiness: number
  mess: number
  asleep: boolean
  mood: Mood
  ageMs: number
}

export type Outcome = { record: PetRecord; message: string; ok: boolean }

export const isAsleepAt = (ms: number): boolean => {
  const hour = new Date(ms).getHours()

  return hour >= 23 || hour < 7
}

/** Ms until the next sleep/wake boundary (23:00 or 07:00 local) after `ms`. */
export const untilSleepChange = (ms: number): number => {
  const d = new Date(ms)
  const next = new Date(ms)
  next.setMinutes(0, 0, 0)
  const h = d.getHours()
  if (h >= 23) { next.setDate(next.getDate() + 1); next.setHours(7) }
  else if (h < 7) next.setHours(7)
  else next.setHours(23)

  return next.getTime() - ms
}

/** Time between `from` and `to`, sleeping hours counted at SLEEP_WEIGHT. */
export const weightedMs = (from: number, to: number): number => {
  if (to <= from) return 0
  let t = Math.max(from, to - MAX_LOOKBACK)
  let sum = 0

  while (t < to) {
    const top = new Date(t)
    top.setMinutes(0, 0, 0)
    const next = Math.min(to, top.getTime() + HOUR)
    sum += (next - t) * (isAsleepAt(t) ? SLEEP_WEIGHT : 1)
    t = next
  }

  return sum
}

/** `rate` scales the time added since the meter was last touched, not the meter's unit. */
const meterNow = (m: Meter, unit: number, now: number, rate = 1): number =>
  Math.min(MAX_LEVEL * unit, m.ms + weightedMs(m.at, now) * rate)

const stageAt = (age: number): Stage =>
  age < EGG_MS ? 'egg' : age < BABY_MS ? 'baby' : 'adult'

export const createPet = (now: number, name = '小貓'): PetRecord => ({
  name,
  bornAt: now,
  hunger: { ms: 0, at: now },
  bored: { ms: 0, at: now },
  poopAt: [],
})

export const computePet = (rec: PetRecord, now: number): PetView => {
  const ageMs = Math.max(0, now - rec.bornAt)
  const stage = stageAt(ageMs)
  const hunger = Math.min(MAX_LEVEL, Math.floor(meterNow(rec.hunger, HUNGER_UNIT, now, personalityOf(rec).hungerRate) / HUNGER_UNIT))
  const bored = Math.min(MAX_LEVEL, Math.floor(meterNow(rec.bored, BORED_UNIT, now, personalityOf(rec).boredRate) / BORED_UNIT))
  const happiness = MAX_LEVEL - bored
  const mess = rec.poopAt.filter(t => t <= now).length
  const asleep = stage !== 'egg' && isAsleepAt(now)
  const mood: Mood = asleep
    ? 'sleeping'
    : hunger >= 4
      ? 'starving'
      : mess >= 2
        ? 'dirty'
        : happiness <= 1
          ? 'sad'
          : hunger >= 3
            ? 'hungry'
            : 'happy'

  return { name: rec.name, stage, hunger, happiness, mess, asleep, mood, ageMs }
}

const reduce = (m: Meter, unit: number, levels: number, now: number, rate = 1): Meter => ({
  ms: Math.max(0, meterNow(m, unit, now, rate) - levels * unit),
  at: now,
})

const refuse = (record: PetRecord, message: string): Outcome => ({ record, message, ok: false })

export const feed = (rec: PetRecord, now: number): Outcome => {
  const v = computePet(rec, now)
  if (v.stage === 'egg') return refuse(rec, '還縮在紙箱裡,等牠出來再餵吧。')
  if (v.asleep) return refuse(rec, `${v.name} 睡著了 zzZ,早上七點後再餵吧。`)
  if (v.hunger === 0) return refuse(rec, `${v.name} 吃不下了,肚子圓滾滾的,喵~`)

  return {
    ok: true,
    message: personalityOf(rec).lines.fed(v.name),
    record: {
      ...rec,
      hunger: reduce(rec.hunger, HUNGER_UNIT, 3, now, personalityOf(rec).hungerRate),
      poopAt: [...rec.poopAt, now + POOP_DELAY],
    },
  }
}

export const play = (rec: PetRecord, now: number): Outcome => {
  const v = computePet(rec, now)
  if (v.stage === 'egg') return refuse(rec, '紙箱輕輕動了一下。')
  if (v.asleep) {
    return {
      ok: false,
      message: `${v.name} 被吵醒了,不太開心……`,
      record: { ...rec, bored: { ms: meterNow(rec.bored, BORED_UNIT, now, personalityOf(rec).boredRate) + BORED_UNIT, at: now } },
    }
  }
  if (v.hunger >= 4) return refuse(rec, `${v.name} 太餓了,沒力氣玩。`)

  return {
    ok: true,
    message: personalityOf(rec).lines.played(v.name),
    record: { ...rec, bored: reduce(rec.bored, BORED_UNIT, 3, now, personalityOf(rec).boredRate) },
  }
}

export const clean = (rec: PetRecord, now: number): Outcome => {
  const v = computePet(rec, now)
  if (v.mess === 0) return refuse(rec, '很乾淨,不需要打掃。')

  return {
    ok: true,
    message: personalityOf(rec).lines.cleaned(rec.name),
    record: { ...rec, poopAt: rec.poopAt.filter(t => t > now) },
  }
}

export const rename = (rec: PetRecord, name: string): PetRecord => ({
  ...rec,
  name: name.trim().slice(0, 12) || rec.name,
})

/**
 * Changes the personality. Both meters are brought up to `now` at the old rates first,
 * so the time since they were last touched is not re-priced at the new ones.
 */
export const setPersonality = (rec: PetRecord, id: PersonalityId, now: number): PetRecord => {
  const old = personalityOf(rec)

  return {
    ...rec,
    hunger: { ms: meterNow(rec.hunger, HUNGER_UNIT, now, old.hungerRate), at: now },
    bored: { ms: meterNow(rec.bored, BORED_UNIT, now, old.boredRate), at: now },
    personality: id,
  }
}
