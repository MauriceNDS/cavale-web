import { useId, type ReactNode } from 'react'
import i18n from '../i18n'

/**
 * App-wide glossary. Definitions come from the owner's plan (Allures & Zones)
 * and live in the `glossary` i18n namespace; the matching terms below are
 * French training tokens detected inside user content — never translated.
 */
const GLOSSARY_KEYS: Record<string, string> = {
  RPE: 'rpe',
  UA: 'ua',
  RE: 're',
  'D+': 'dplus',
  Récup: 'recup',
  EF: 'ef',
  Tempo: 'tempo',
  'Seuil 60': 'seuil60',
  'Seuil 30': 'seuil30',
  VMA: 'vma',
  Sprint: 'sprint',
  Test: 'test',
}

/** Localized definition for a term — resolved at render time, never at module load. */
function glossaryEntry(term: string): { title: string; body: string } | null {
  const key = GLOSSARY_KEYS[term]
  if (!key) return null
  return {
    title: i18n.t(`glossary:${key}.title`),
    body: i18n.t(`glossary:${key}.body`),
  }
}

/** Find the glossary entry matching a zone label (e.g. "EF + Sprint" → EF). */
export function glossaryKeyFor(label: string): string | null {
  if (GLOSSARY_KEYS[label]) return label
  const keys = Object.keys(GLOSSARY_KEYS).sort((a, b) => b.length - a.length)
  return keys.find((k) => label.includes(k)) ?? null
}

/**
 * Inline term with a "?" affordance: dotted underline + popover on
 * hover/focus. Keyboard and touch friendly (it's a real button).
 */
export function InfoTip({ term, children }: { term: string; children?: ReactNode }) {
  const entry = glossaryEntry(term)
  const tipId = useId()
  if (!entry) return <>{children ?? term}</>

  return (
    <span className="group/tip relative inline-block">
      <button
        type="button"
        aria-describedby={tipId}
        onClick={(e) => e.stopPropagation()}
        className="cursor-help underline decoration-moss-300 decoration-dotted underline-offset-2 outline-none focus-visible:decoration-pine-600 dark:decoration-moss-500 dark:focus-visible:decoration-pine-350"
      >
        {children ?? term}
      </button>
      <span
        id={tipId}
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-40 mb-1.5 w-64 -translate-x-1/2 rounded-lg border border-moss-200 bg-moss-25 p-2.5 text-left opacity-0 shadow-lg transition-opacity group-focus-within/tip:visible group-focus-within/tip:opacity-100 group-hover/tip:visible group-hover/tip:opacity-100 dark:border-moss-700 dark:bg-moss-800"
      >
        <span className="block text-xs font-semibold text-ink dark:text-linen">{entry.title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed font-normal text-moss-500 normal-case dark:text-moss-400">
          {entry.body}
        </span>
      </span>
    </span>
  )
}

const TERM_RE = new RegExp(
  '(Seuil 60|Seuil 30|Récupération|Récup|Tempo|VMA|RPE|Sprint|D\\+|\\bUA\\b|\\bRE\\b|\\bEF\\b)',
  'g',
)

/** Renders free text with known training terms wired to their glossary tips. */
export function GlossaryText({ text }: { text: string }) {
  const parts = text.split(TERM_RE)
  return (
    <>
      {parts.map((part, i) => {
        const key = part === 'Récupération' ? 'Récup' : part
        return GLOSSARY_KEYS[key] ? (
          <InfoTip key={i} term={key}>
            {part}
          </InfoTip>
        ) : (
          <span key={i}>{part}</span>
        )
      })}
    </>
  )
}
