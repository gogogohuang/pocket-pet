# Pet personality

Status: implemented in 0.7.0.

## Goal

The owner can give their cat a personality. The personality changes how the cat moves, how it
reacts to what Claude is doing, how quickly it gets hungry or bored, and what it says. Two cats
with different personalities should be recognisable from a few seconds of watching the pane.

## Non-goals

- Custom traits or sliders. Version 1 is a fixed list of presets; a trait editor can come later.
- Personality that changes by itself over time or from how the owner treats the cat.
- The web page (Gogo's Room). It is a separate artifact and stays as it is.
- Languages other than Traditional Chinese for the cat's lines.

## Presets

| id | label | one line |
| --- | --- | --- |
| `normal` | 普通 | The cat as it is today. Default for every existing and new cat. |
| `playful` | 活潑 | Always on the move; jumps and chases a lot; gets bored fast. |
| `lazy` | 慵懶 | Mostly sits and naps; dozes off sooner; slow to get hungry. |
| `curious` | 好奇 | Interested in what Claude reads and runs; perks up at typing. |
| `aloof` | 傲嬌 | Pretends not to care; ignores typing; reacts to Claude late. |
| `clingy` | 黏人 | Stays near the middle; watches the owner type; cheers harder when done. |

## What a personality changes

A personality is a plain data record, so every preset is one table row, not branching code.

1. **Behaviour weights.** The chance of each idle action (walk, jump, groom, stretch, scratch,
   yawn, roll, crouch and pounce, spin, sit) when the cat picks what to do next. Today these are
   the thresholds in `step()` in `anim.ts`; they become a weight table per personality.
   `normal` must reproduce today's thresholds exactly.
2. **Movement.** Walking speed multiplier, and how often the cat chooses to walk at all.
3. **Reactions to Claude.**
   - `dozeAfterMs`: how long Claude has to be busy before the cat dozes (today 120 s).
   - `watchesTyping`: whether the cat perks up while the owner types (today yes), and for how
     many frames after the last keystroke (today 4).
   - `celebrateJumps`: how many hops when a turn ends (today: a hop for four seconds).
   - `startleMs`: how long it stays startled after a tool failure (today 2.5 s).
   - `lag`: frames before the cat reacts to a new activity. `aloof` uses this; the rest use 0.
4. **Needs.** `hungerRate` and `boredRate`, multipliers on how fast those meters grow
   (`normal` = 1). Range 0.5 to 2. They scale the time added to a meter, not the level unit, so a
   change does not make existing levels jump.
5. **Voice.** The toasts (`hungry`, `dirty`, `woke up`, `goodbye`) and the success messages for
   feed, play and clean have one line per personality. `normal` keeps today's text. Refusals
   ("too full", "asleep") are the same for every personality.

## Interface

- `/pet personality` shows the current personality and lists the presets with their one-line
  descriptions.
- `/pet personality <id>` sets it. The id is the English id above; the Chinese label is also
  accepted. An unknown name leaves the cat unchanged and answers with the list.
- The pane's title line shows the label: `Gogo · 成貓 · 3 天 · 活潑`.
- Switching is free and can be done any time. The reply says what changes, in one line.

## Data

`PetRecord` gains one optional field:

```ts
personality?: PersonalityId   // absent means 'normal'
```

Records written by 0.6.x and earlier have no such field and must load unchanged. Nothing is
migrated; the field is written the first time the owner sets a personality.

**Switching settles the meters first.** Before storing the new personality, both meters are
advanced to now with the old rates (`meterNow`), then the record is saved with the new id. Without
this, the time since the meters were last touched would be re-priced at the new rate.

## Code layout

- New `hooks/personality.ts`: the `PersonalityId` type, the `Personality` shape, the preset table,
  `personalityOf(record)` (defaults to `normal`) and `parsePersonality(text)`. Pure, no `$`.
- `pet.ts`: `meterNow` and `computePet` take the rates from the personality; `setPersonality`
  returns an `Outcome` like `feed` and `play`; message text comes from `personality.lines`.
- `anim.ts`: `step()` takes the personality in `StepOptions` and uses its weights, speed and
  reaction fields instead of the literals. `normal` leaves today's output unchanged.
- `register.tsx`: parses `/pet personality ...`, passes the personality to `step()`, uses
  `lines` for toasts.

## Decisions to confirm

1. **Do needs change, or is it only looks and behaviour?** This spec says needs change
   (`hungerRate`, `boredRate`), because a lazy cat that is just as hungry as a playful one feels
   like a skin. The cost is that the game balance now has six variants to keep sane. If you prefer
   it cosmetic, drop section 4 and the settling rule.
2. **Default.** Everyone starts as `normal`, so nothing changes for existing cats until the owner
   chooses. The alternative is to draw a random personality when the egg hatches. This spec does
   not do that, because it would change a cat the owner already knows.
3. **The list.** Five presets besides `normal`. Add, remove or rename freely; the code does not
   depend on the count.
4. **`aloof` lag.** A cat that reacts late can look like the plugin is broken. The spec keeps it
   small (at most 4 frames, about 1.6 s) and the pane shows the label so it reads as a trait.

## Acceptance criteria

1. A record with no `personality` field loads, behaves exactly as in 0.6.x, and reports `normal`.
2. `normal` gives the same sequence of poses as today for the same random numbers and inputs
   (the existing animation tests pass unchanged).
3. For each pair of presets, over several thousand frames with a seeded random source, the
   measured share of at least one action differs in the direction the table above states (for
   example: `playful` jumps more than `lazy`; `lazy` sits and yawns more than `playful`).
4. `lazy` dozes after its shorter wait; `aloof` ignores typing; `clingy` perks up for longer than
   `normal`.
5. Over the same awake hours, a cat with a higher `hungerRate` is hungrier than one with a lower
   one, and `normal` matches today's levels.
6. Switching personality does not change either meter's level at the moment of the switch.
7. `/pet personality` lists the presets; `/pet personality 活潑` and `/pet personality playful`
   both set it; `/pet personality nonsense` changes nothing and says so.
8. `claude plugin validate .` passes, all tests pass, and a type check against the plugin API
   types shows no errors.

## Test plan

- `personality.test.ts`: every preset has all fields; weights are positive; `parsePersonality`
  accepts ids and labels, rejects the rest; `personalityOf` defaults.
- `pet.test.ts`: rates change levels as in criterion 5; settling keeps levels (criterion 6);
  an old record loads (criterion 1).
- `anim.test.ts`: the statistical comparisons in criterion 3 and the reaction fields in 4, using
  the existing seeded random helper.
- Manual: set each personality, open the pane, and watch for a minute; then run one Claude turn
  with a permission prompt and see that the reactions match the table.

## Rollout

Ships as a minor version with a README section listing the presets. Because the field is optional
and defaults to `normal`, downgrading leaves the field in the store, where older versions ignore it.
