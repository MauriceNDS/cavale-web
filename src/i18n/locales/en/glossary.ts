/**
 * Glossary definitions (Paces & Zones). The matching terms/regexes live in
 * src/lib/glossary.tsx and are language-independent — only these definitions
 * are localized. Zone tokens (EF, VMA, Seuil…) are never translated.
 */
export default {
  rpe: {
    title: 'RPE — rate of perceived exertion (Foster, 0–10)',
    body: '2–3 easy · 4–5 long aerobic · 6–7 threshold/tempo · 8–9 VO2/hills · 10 maximal. Session load = RPE × duration.',
  },
  ua: {
    title: 'UA — arbitrary units (load)',
    body: 'Training load = session RPE (0–10) × duration (min), summed per week. Guardrail: ACWR < 1.3.',
  },
  re: {
    title: 'RE — relative effort',
    body: 'Strava’s measure of an activity’s overall load, based on heart rate.',
  },
  dplus: {
    title: 'D+ — elevation gain',
    body: 'Total meters climbed. Its twin D− (descent) is the SaintéLyon specialty: 2,700 m to absorb.',
  },
  recup: {
    title: 'Récup zone (recovery)',
    body: '> 6:30/km · HR < 130 · RPE 1-2. “Day-after” jog, nasal breathing possible.',
  },
  ef: {
    title: 'EF — fundamental endurance',
    body: '5:45–6:15/km · HR ≤ 145 · RPE 2-3. Full, easy conversation. 70–80% of total volume.',
  },
  tempo: {
    title: 'Tempo / race pace (AC)',
    body: '5:40–6:00/km · HR 146–155 · RPE 4-5. “Dynamic ease” — SaintéLyon pace on the flat.',
  },
  seuil60: {
    title: 'Seuil 60 (60-min threshold)',
    body: '4:32–4:40/km · HR 156–163 · RPE 6-7. “Comfortably hard”, sustainable ~1 h. The plan’s common thread.',
  },
  seuil30: {
    title: 'Seuil 30 (30-min threshold)',
    body: '4:18–4:25/km · HR 164–170 · RPE 7-8. It stings, sustainable ~30′. No more conversation.',
  },
  vma: {
    title: 'VMA — maximal aerobic speed',
    body: '3:58–4:08/km · RPE 8-9. Limit speed ~5–6′. Never a sprint: the last rep should look like the first.',
  },
  sprint: {
    title: 'Sprint / strides',
    body: '< 3:30/km over 15–20″ · RPE 9 (short). Progressive, relaxed, technical accelerations. Zero exhaustion.',
  },
  test: {
    title: 'LTHR 30′ test',
    body: '30′ at a maximal steady intensity; average HR of the last 20 minutes = LTHR. Recalibrates every zone.',
  },
}
