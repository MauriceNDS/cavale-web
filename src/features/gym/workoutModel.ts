import type { SetLogResponse, WorkoutBlockResponse, WorkoutDetailResponse } from './api'

/**
 * A step is what the athlete is doing at one moment: a single exercise, or
 * a superset performed in rotation. The runner never shows more than one.
 *
 * Consecutive blocks sharing a group key form one step; everything else
 * stands alone. A group runs for as many rounds as its longest member has
 * sets, which is also what makes a whole-variant group behave as a circuit
 * without any special case.
 */
export interface Step {
  id: string
  groupKey: string | null
  blocks: WorkoutBlockResponse[]
  /** Rounds for a superset, sets for a lone exercise — the same number. */
  rounds: number
}

export function blockId(block: WorkoutBlockResponse): string {
  return block.templateExerciseId ?? block.extraBlockId!
}

export function setKey(exerciseId: string, setNumber: number): string {
  return `${exerciseId}:${setNumber}`
}

/** Rows to render for a block: the effective sets, never hiding a logged set. */
export function totalRows(block: WorkoutBlockResponse, loggedSets: SetLogResponse[]): number {
  const maxLogged = loggedSets
    .filter((s) => s.exerciseId === block.exercise.id)
    .reduce((max, s) => Math.max(max, s.setNumber), 0)
  return Math.max(block.sets, maxLogged)
}

/** Group the blocks into steps, in order. Extra blocks never join a superset. */
export function buildSteps(detail: WorkoutDetailResponse): Step[] {
  const steps: Step[] = []
  for (const block of detail.blocks) {
    const previous = steps.at(-1)
    const key = block.extraBlockId != null ? null : block.groupKey
    if (key != null && previous?.groupKey === key) {
      previous.blocks.push(block)
      previous.rounds = Math.max(previous.rounds, totalRows(block, detail.log.sets))
      continue
    }
    steps.push({
      id: blockId(block),
      groupKey: key,
      blocks: [block],
      rounds: totalRows(block, detail.log.sets),
    })
  }
  return steps
}

/** The blocks of a step that are still on the menu for a given round. */
export function blocksInRound(step: Step, round: number, loggedSets: SetLogResponse[]) {
  return step.blocks.filter((b) => !b.skipped && round <= totalRows(b, loggedSets))
}

/**
 * Where to resume: the first round of the first step that isn't finished.
 * Reopening the app mid-session should land where you actually are.
 */
export function firstUnfinished(steps: Step[], loggedSets: SetLogResponse[]): {
  stepIndex: number
  round: number
} {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    for (let round = 1; round <= step.rounds; round++) {
      const due = blocksInRound(step, round, loggedSets)
      if (due.length === 0) continue
      const allLogged = due.every((block) =>
        loggedSets.some((s) => s.exerciseId === block.exercise.id && s.setNumber === round),
      )
      if (!allLogged) return { stepIndex: i, round }
    }
  }
  return { stepIndex: Math.max(0, steps.length - 1), round: 1 }
}

/** The rest owed after finishing `block` in `round` — intra-group or full. */
export function restAfter(step: Step, block: WorkoutBlockResponse, round: number,
                          loggedSets: SetLogResponse[]): number | null {
  const due = blocksInRound(step, round, loggedSets)
  const position = due.findIndex((b) => blockId(b) === blockId(block))
  const isLastOfRound = position === due.length - 1
  // inside a superset the short rest is the transition to the next partner;
  // on the last member it is the real rest before the next round
  if (!isLastOfRound) return block.restSec
  return round < step.rounds ? block.restSec : null
}
