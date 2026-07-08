import { useId, type ReactNode } from 'react'

/** App-wide glossary. Definitions come from the owner's plan (Allures & Zones). */
export const GLOSSARY: Record<string, { title: string; body: string }> = {
  RPE: {
    title: 'RPE — perception de l’effort (Foster, 0–10)',
    body: '2–3 facile · 4–5 longue aérobie · 6–7 seuil/tempo · 8–9 VO2/côtes · 10 maximal. La charge d’une séance = RPE × durée.',
  },
  UA: {
    title: 'UA — unités arbitraires (charge)',
    body: 'Charge d’entraînement = RPE de séance (0–10) × durée (min), sommée par semaine. Garde-fou : ACWR < 1,3.',
  },
  RE: {
    title: 'RE — effort relatif',
    body: 'Mesure Strava de la charge globale d’une activité, basée sur la fréquence cardiaque.',
  },
  'D+': {
    title: 'D+ — dénivelé positif',
    body: 'Cumul des mètres grimpés. Son jumeau D− (descente) est la spécificité SaintéLyon : 2 700 m à encaisser.',
  },
  Récup: {
    title: 'Zone Récup',
    body: '> 6:30/km · FC < 130 · RPE 1-2. Trot de « lendemain », respiration nasale possible.',
  },
  EF: {
    title: 'EF — endurance fondamentale',
    body: '5:45–6:15/km · FC ≤ 145 · RPE 2-3. Conversation complète et facile. 70–80 % du volume total.',
  },
  Tempo: {
    title: 'Tempo / allure course (AC)',
    body: '5:40–6:00/km · FC 146–155 · RPE 4-5. « Aisance dynamique » — l’allure SaintéLyon sur le plat.',
  },
  'Seuil 60': {
    title: 'Seuil 60',
    body: '4:32–4:40/km · FC 156–163 · RPE 6-7. « Confortablement difficile », tenable ~1 h. Le fil rouge du plan.',
  },
  'Seuil 30': {
    title: 'Seuil 30',
    body: '4:18–4:25/km · FC 164–170 · RPE 7-8. Ça pique, tenable ~30′. Plus de conversation.',
  },
  VMA: {
    title: 'VMA — vitesse maximale aérobie',
    body: '3:58–4:08/km · RPE 8-9. Vitesse limite ~5–6′. Jamais un sprint : la dernière rép doit ressembler à la première.',
  },
  Sprint: {
    title: 'Sprint / lignes droites',
    body: '< 3:30/km sur 15–20″ · RPE 9 (court). Accélérations progressives, relâchées, techniques. Zéro épuisement.',
  },
  Test: {
    title: 'Test LTHR 30′',
    body: '30′ à intensité maximale régulière ; FC moyenne des 20 dernières minutes = LTHR. Recale toutes les zones.',
  },
}

/** Find the glossary entry matching a zone label (e.g. "EF + Sprint" → EF). */
export function glossaryKeyFor(label: string): string | null {
  if (GLOSSARY[label]) return label
  const keys = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length)
  return keys.find((k) => label.includes(k)) ?? null
}

/**
 * Inline term with a "?" affordance: dotted underline + popover on
 * hover/focus. Keyboard and touch friendly (it's a real button).
 */
export function InfoTip({ term, children }: { term: string; children?: ReactNode }) {
  const entry = GLOSSARY[term]
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
        return GLOSSARY[key] ? (
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
