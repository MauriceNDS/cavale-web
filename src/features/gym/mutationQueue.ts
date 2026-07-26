import { ApiError, getToken, type ProblemDetail } from '../../lib/api'

const STORAGE_KEY = 'cavale.gym.queue'

/**
 * Writes that must survive a gym basement.
 *
 * Every action in the live workout goes through here: the screen updates
 * from local state immediately and the request is queued, so a tap never
 * waits for the network and never fails because there isn't one. The queue
 * lives in localStorage, so walking out of signal and closing the app does
 * not lose the sets.
 *
 * Two properties make this safe rather than merely optimistic:
 *
 * - **Every operation is idempotent.** Logging a set is an upsert keyed by
 *   (workout, exercise, set number), so replaying it changes nothing.
 * - **Operations coalesce by key.** Correcting a set four times while
 *   offline leaves one pending write, not four, and the last value wins.
 */
export interface QueuedOp {
  id: string
  /** Same key ⇒ the newer op replaces the older one still waiting. */
  key: string
  method: 'PUT' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  body?: unknown
  /** Attempts so far — used to back off, and to give up on a 4xx. */
  tries: number
}

type Listener = (state: QueueState) => void

export interface QueueState {
  pending: number
  online: boolean
  /** Set when the server rejected an op for good (4xx) — needs the user. */
  lastError: string | null
}

function load(): QueuedOp[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as QueuedOp[]) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

class MutationQueue {
  private ops: QueuedOp[] = load()
  private listeners = new Set<Listener>()
  private draining = false
  private lastError: string | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private seq = 0

  constructor() {
    window.addEventListener('online', () => void this.drain())
    // a tab coming back to life is the other moment worth retrying
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.drain()
    })
    // Writes restored from a previous session are already waiting: without
    // this they would sit untouched until the connection happened to flap,
    // which for a workout logged offline and reopened later means never.
    if (this.ops.length > 0) setTimeout(() => void this.drain(), 0)
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    listener(this.state())
    return () => this.listeners.delete(listener)
  }

  state(): QueueState {
    return { pending: this.ops.length, online: navigator.onLine, lastError: this.lastError }
  }

  private emit() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.ops))
    const state = this.state()
    this.listeners.forEach((l) => l(state))
  }

  /**
   * Queue a write. A pending op with the same key is replaced — the newer
   * intent is the true one, and the server never needs to see the churn.
   */
  push(op: Omit<QueuedOp, 'id' | 'tries'>) {
    this.ops = this.ops.filter((existing) => existing.key !== op.key)
    this.ops.push({ ...op, id: `${Date.now()}-${this.seq++}`, tries: 0 })
    this.lastError = null
    this.emit()
    void this.drain()
  }

  /**
   * Drop a pending op without sending it — for the case where an action
   * and its undo both happen offline and cancel out entirely.
   * @returns whether something was actually waiting
   */
  cancel(key: string): boolean {
    const before = this.ops.length
    this.ops = this.ops.filter((op) => op.key !== key)
    const dropped = this.ops.length < before
    if (dropped) this.emit()
    return dropped
  }

  async drain(): Promise<void> {
    if (this.draining || this.ops.length === 0) return
    if (!navigator.onLine) return
    this.draining = true
    try {
      while (this.ops.length > 0 && navigator.onLine) {
        const op = this.ops[0]
        try {
          await send(op)
          this.ops.shift()
          this.lastError = null
          this.emit()
        } catch (error) {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
            // the server will never accept this one; keeping it would block
            // everything behind it forever
            this.ops.shift()
            this.lastError = error.message
            this.emit()
            continue
          }
          op.tries += 1
          this.emit()
          this.scheduleRetry(op.tries)
          return
        }
      }
    } finally {
      this.draining = false
    }
  }

  private scheduleRetry(tries: number) {
    if (this.timer) clearTimeout(this.timer)
    const delay = Math.min(30_000, 1000 * 2 ** Math.min(tries, 5))
    this.timer = setTimeout(() => void this.drain(), delay)
  }
}

async function send(op: QueuedOp): Promise<void> {
  const token = getToken()
  const response = await fetch(op.path, {
    method: op.method,
    headers: {
      ...(op.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: op.body !== undefined ? JSON.stringify(op.body) : undefined,
  })
  if (!response.ok) {
    let problem: ProblemDetail = { title: `HTTP ${response.status}`, status: response.status }
    try {
      problem = { ...problem, ...((await response.json()) as ProblemDetail) }
    } catch {
      /* not a problem+json body — the status alone will have to do */
    }
    throw new ApiError(problem)
  }
}

export const gymQueue = new MutationQueue()
