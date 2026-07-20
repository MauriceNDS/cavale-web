export default {
  login: {
    title: 'Se connecter',
    subtitle: 'Bon retour sur les sentiers.',
    email: 'Email',
    password: 'Mot de passe',
    submit: 'Se connecter',
    submitting: 'Connexion…',
    noAccount: 'Pas encore de compte ?',
    createOne: 'En créer un',
    errors: {
      emailInvalid: 'Adresse email invalide',
      passwordRequired: 'Mot de passe requis',
    },
  },
  register: {
    title: 'Créer un compte',
    subtitle: 'Cours libre. Entraîne-toi avec intention.',
    email: 'Email',
    password: 'Mot de passe',
    displayName: 'Nom affiché',
    submit: 'Créer mon compte',
    haveAccount: 'Déjà un compte ?',
    signIn: 'Se connecter',
    errors: {
      emailInvalid: 'Adresse email invalide',
      passwordMin: 'Au moins 8 caractères',
      passwordMax: 'Au plus 72 caractères',
      nameRequired: 'Le nom est requis',
    },
  },
  onboarding: {
    title: 'Bienvenue sur Cavale 🏔',
    intro: 'Deux minutes pour personnaliser ton entraînement — tout reste modifiable dans ton profil.',
    profile: {
      title: "Ton profil d'athlète",
      intro: "Poids, FC et date de naissance nourrissent les statistiques et l'estimation d'effort.",
      displayName: 'Nom affiché',
      weight: 'Poids (kg)',
      height: 'Taille (cm)',
      birthDate: 'Date de naissance',
      maxHr: 'FC max',
      restingHr: 'FC repos',
    },
    usage: {
      title: 'Tu utilises Cavale pour…',
      runningOnly: {
        title: 'La course uniquement',
        description:
          'Plans, calendrier, Strava et statistiques. Le renfo reste activable plus tard dans les paramètres.',
      },
      runningAndGym: {
        title: 'Course + renfo',
        description:
          'Tout, plus les programmes de force, le suivi des séances en salle et leurs statistiques.',
      },
    },
    submit: "C'est parti",
    later: 'Plus tard',
  },
  stravaCallback: {
    connecting: 'Connexion…',
    cancelledTitle: 'Connexion Strava annulée',
    cancelledBody: "L'autorisation n'a pas abouti. Tu peux réessayer ou te connecter par email.",
    backToLogin: 'Retour à la connexion',
  },
  strava: {
    continue: 'Continuer avec Strava',
    redirecting: 'Redirection…',
    notConfigured: "L'intégration Strava n'est pas encore configurée sur ce serveur.",
    unavailable: 'Connexion Strava indisponible. Réessaie.',
    orEmail: 'ou par email',
  },
  demo: {
    cta: 'Découvrir la démo',
    starting: 'Préparation de la démo…',
    error: 'La démo est momentanément indisponible — réessaie.',
    orDemo: 'juste curieux ?',
  },
  devLogin: {
    title: 'Environnement dev',
    emailPlaceholder: 'email du compte',
    submit: 'Entrer',
    submitting: 'Connexion…',
  },
  pending: {
    pendingTitle: 'Compte en attente de validation',
    pendingBody:
      "Ton compte a bien été créé. Un administrateur doit l'activer avant que tu puisses commencer à t'entraîner — tu y auras accès dès qu'il sera validé.",
    disabledTitle: 'Compte désactivé',
    disabledBody:
      "Ton accès a été coupé. Contacte un administrateur si tu penses qu'il s'agit d'une erreur.",
    signedInAs: 'Connecté en tant que {{email}}',
    recheck: 'Vérifier à nouveau',
    signOut: 'Se déconnecter',
  },
}
