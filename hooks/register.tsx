import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import { initialAnim, scene, step, throwBall, workPose } from './anim'
import type { Activity, Anim } from './anim'
import { clean, computePet, createPet, feed, play, rename, untilSleepChange } from './pet'
import type { Mood, Outcome, PetRecord, PetView, Stage } from './pet'

const PANE = 'pocket-pet'
const KEY = 'pet'
const TICK_MS = 60_000
const FRAME_MS = 400

const msg = atom({ plugin: 'pocket-pet', key: 'msg' } as const, '')

const FACE: Record<Mood, string> = {
  happy: '(=^ω^=)',
  hungry: '(=•﹏•=)',
  starving: '(=x﹏x=)',
  dirty: '(=>_<=)',
  sad: '(=;ω;=)',
  sleeping: '(=-ω-=) zZ',
}

const body = (stage: Stage, mood: Mood): string[] => {
  if (stage === 'egg') return ['  _______  ', ' |       | ', ' | 紙 箱 | ', ' |_______| ']
  const face = FACE[mood]
  if (stage === 'baby') return ['  /\_/\  ', ` ${face} `, '  >   <  ', '  (_" "_)']

  return ['  /\___/\  ', ` ${face} `, '  /  w  \  ', ' (__|_|__)~', '        ']
}

const bar = (n: number, full: string, empty: string) => full.repeat(n) + empty.repeat(5 - n)

const age = (ms: number) => {
  const m = Math.floor(ms / 60_000)
  if (m < 60) return `${m} 分鐘`
  if (m < 60 * 48) return `${Math.floor(m / 60)} 小時`

  return `${Math.floor(m / 1440)} 天`
}

const clock = (ms: number) => {
  const d = new Date(ms)
  const p = (n: number) => String(n).padStart(2, '0')

  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

const span = (ms: number) => {
  const m = Math.ceil(ms / 60_000)

  return m >= 60 ? `${Math.floor(m / 60)} 小時 ${m % 60} 分` : `${m} 分`
}

const summary = (v: PetView) =>
  `${v.stage === 'egg' ? '📦' : v.asleep ? '😴' : v.mood === 'happy' ? '😺' : v.mood === 'sad' || v.mood === 'starving' ? '😿' : '🐱'} ${bar(5 - v.hunger, '🍙', '·')} ${bar(v.happiness, '♥', '♡')}${v.mess ? ' 💩'.repeat(v.mess) : ''}`

let lastMood: Mood | undefined
let anim: Anim = initialAnim()
// What Claude is doing. `done` and `failed` are brief; the rest last until the next event.
let activity: Activity = 'idle'
let activityUntil = 0
let lastTool = ''
const MARK: Record<Activity, string> = { idle: '', working: '', asking: '!', done: '♥', failed: '?' }
const DOING: Record<Activity, string> = {
  idle: '',
  working: '💻 Claude 工作中',
  asking: '❗ Claude 在等你回應',
  done: '✅ Claude 做完了',
  failed: '⚠️ Claude 出錯了',
}

const ICON: Record<Activity, string> = { idle: '', working: '💻', asking: '❗', done: '✅', failed: '⚠️' }
let lastSummary = ''
let expiry: { cancel: () => void } | undefined

/** The status line: Claude's activity (if any) in front of the cat's own summary. */
function paintStatus($: EngineInterface) {
  if (!lastSummary) return
  const doing = activity === 'idle' ? '' : `${ICON[activity]}${activity === 'working' && lastTool ? ` ${lastTool}` : ''} `
  $.ui.status(doing + lastSummary)
}

// Runs inside the model's tool loop, so it must never throw into it.
async function setActivity($: EngineInterface, next: Activity, forMs = 0) {
  try {
    activity = next
    activityUntil = forMs ? (await $.clock.now()) + forMs : 0
    expiry?.cancel()
    expiry = forMs ? $.clock.after(forMs, () => { if (activity === next) void setActivity($, 'idle') }) : undefined
    paintStatus($)
    $.ui.invalidate('ui.render')
  } catch {
    activityUntil = 0
  }
}

let stopFrames: (() => void) | undefined

/** Advance the cat one frame and redraw; runs only while the pane is open. */
async function frame($: EngineInterface) {
  const v = computePet(await load($), await $.clock.now())
  if (activityUntil && (await $.clock.now()) >= activityUntil) await setActivity($, 'idle')
  anim = step(anim, v.mood, Math.random, activity, workPose(lastTool))
  $.ui.invalidate('ui.render')
}

async function load($: EngineInterface): Promise<PetRecord> {
  const stored = (await $.store.get(KEY)) as PetRecord | undefined
  if (stored) return stored
  const fresh = createPet(await $.clock.now())
  await $.store.set(KEY, fresh)

  return fresh
}

async function refresh($: EngineInterface, announce: boolean) {
  const now = await $.clock.now()
  const v = computePet(await load($), now)
  lastSummary = summary(v)
  paintStatus($)
  if (announce && v.mood !== lastMood) {
    if (v.mood === 'hungry' || v.mood === 'starving') $.ui.toast(`${v.name} 餓了!`)
    else if (v.mood === 'dirty') $.ui.toast(`${v.name} 的貓砂盆該清了`)
    else if (lastMood === 'sleeping' && v.mood !== 'sleeping') $.ui.toast(`${v.name} 睡醒了`)
  }
  lastMood = v.mood
  $.ui.invalidate('ui.render')
}

async function act($: EngineInterface, run: (r: PetRecord, now: number) => Outcome) {
  const now = await $.clock.now()
  const out = run(await load($), now)
  await $.store.set(KEY, out.record)
  await update($, msg, () => out.message)
  if (run === play && out.ok) anim = throwBall(anim, Math.random)
  await refresh($, false)
}


export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'pet', description: '養貓:/pet 開面板,/pet name <名字> 改名' })
    await refresh($, true)
    $.clock.every(TICK_MS, () => refresh($, true))

    return next(e)
  })

  on('command.run', { command: 'pet' }, async ($, e) => {
    const name = e.args.match(/^name\s+(.+)$/)?.[1]
    if (name) {
      await $.store.set(KEY, rename(await load($), name))
      await refresh($, false)

      return { text: `改名完成:${name.trim().slice(0, 12)}` }
    }
    await $.ui.open({ id: PANE, title: 'Pet' })
    stopFrames ??= $.clock.every(FRAME_MS, () => frame($))

    return { text: '貓咪面板已開啟。' }
  })

  on('turn.start', async ($, e, next) => {
    lastTool = ''
    await setActivity($, 'working')

    return next(e)
  })

  on('tool.check', async ($, e, next) => {
    const out = await next(e)
    if (out.decision === 'ask') await setActivity($, 'asking')

    return out
  })

  on('tool.call', async ($, e, next) => {
    lastTool = e.tool
    await setActivity($, 'working')

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    await setActivity($, e.reason === 'answer' ? 'done' : 'failed', 4000)

    return next(e)
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) {
      stopFrames?.()
      stopFrames = undefined
    }

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const now = await $.clock.now()
    const v = computePet(await load($), now)
    const note = await read($, msg)
    const feedHint = v.asleep ? '睡覺中' : ''

    return (
      <Box flexDirection="column">
        <Text bold>
          {v.name} · {v.stage === 'egg' ? '紙箱裡' : v.stage === 'baby' ? '幼貓' : '成貓'} · {age(v.ageMs)}
        </Text>
        <Box flexDirection="column" marginY={1}>
          {(v.stage === 'egg' ? body(v.stage, v.mood) : scene(anim, v.mood, MARK[activity])).map(line => (
            <Text>{line}</Text>
          ))}
          {v.mess > 0 && <Text>{'💩'.repeat(v.mess)}</Text>}
        </Box>
        <Text>飽足 {bar(5 - v.hunger, '■', '□')}</Text>
        <Text>心情 {bar(v.happiness, '♥', '♡')}</Text>
        <Text dimColor>
          🕐 {clock(now)} · {v.asleep ? '😴 睡覺中(23:00–07:00)' : '☀️ 清醒中'}
        </Text>
        <Text dimColor>
          {v.asleep ? '⏰ 距離睡醒' : '🌙 距離睡覺'} {span(untilSleepChange(now))}
        </Text>
        <Box marginTop={1}>
          <Button key="feed" label="餵食 [f]" hotkey="f" variant="primary" onPress={() => act($, feed)} />
          <Button key="play" label="玩耍 [p]" hotkey="p" onPress={() => act($, play)} />
          <Button key="clean" label="清理 [c]" hotkey="c" onPress={() => act($, clean)} />
        </Box>
        <Text dimColor>{activity === 'idle' ? '' : `${DOING[activity]}${activity === 'working' && lastTool ? ` · ${lastTool}` : ''}`}</Text>
        <Text dimColor>{note || feedHint}</Text>
        <Text dimColor>{'指令:/pet 開面板 · /pet name <名字> 改名'}</Text>
      </Box>
    )
  })
}
