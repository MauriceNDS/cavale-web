/**
 * Glossary definitions (Allures & Zones). The matching terms/regexes live in
 * src/lib/glossary.tsx and are language-independent — only these definitions
 * are localized. Zone tokens (EF, VMA, Seuil…) are never translated.
 */
export default {
  rpe: {
    title: 'RPE — perception de l’effort (Foster, 0–10)',
    body: '2–3 facile · 4–5 longue aérobie · 6–7 seuil/tempo · 8–9 VO2/côtes · 10 maximal. La charge d’une séance = RPE × durée.',
  },
  ua: {
    title: 'UA — unités arbitraires (charge)',
    body: 'Charge d’entraînement = RPE de séance (0–10) × durée (min), sommée par semaine. Garde-fou : ACWR < 1,3.',
  },
  re: {
    title: 'RE — effort relatif',
    body: 'Mesure Strava de la charge globale d’une activité, basée sur la fréquence cardiaque.',
  },
  dplus: {
    title: 'D+ — dénivelé positif',
    body: 'Cumul des mètres grimpés. Son jumeau D− (descente) est la spécificité SaintéLyon : 2 700 m à encaisser.',
  },
  recup: {
    title: 'Zone Récup',
    body: '> 6:30/km · FC < 130 · RPE 1-2. Trot de « lendemain », respiration nasale possible.',
  },
  ef: {
    title: 'EF — endurance fondamentale',
    body: '5:45–6:15/km · FC ≤ 145 · RPE 2-3. Conversation complète et facile. 70–80 % du volume total.',
  },
  tempo: {
    title: 'Tempo / allure course (AC)',
    body: '5:40–6:00/km · FC 146–155 · RPE 4-5. « Aisance dynamique » — l’allure SaintéLyon sur le plat.',
  },
  seuil60: {
    title: 'Seuil 60',
    body: '4:32–4:40/km · FC 156–163 · RPE 6-7. « Confortablement difficile », tenable ~1 h. Le fil rouge du plan.',
  },
  seuil30: {
    title: 'Seuil 30',
    body: '4:18–4:25/km · FC 164–170 · RPE 7-8. Ça pique, tenable ~30′. Plus de conversation.',
  },
  vma: {
    title: 'VMA — vitesse maximale aérobie',
    body: '3:58–4:08/km · RPE 8-9. Vitesse limite ~5–6′. Jamais un sprint : la dernière rép doit ressembler à la première.',
  },
  sprint: {
    title: 'Sprint / lignes droites',
    body: '< 3:30/km sur 15–20″ · RPE 9 (court). Accélérations progressives, relâchées, techniques. Zéro épuisement.',
  },
  test: {
    title: 'Test LTHR 30′',
    body: '30′ à intensité maximale régulière ; FC moyenne des 20 dernières minutes = LTHR. Recale toutes les zones.',
  },
}
