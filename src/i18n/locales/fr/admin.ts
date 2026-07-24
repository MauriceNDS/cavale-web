export default {
  title: 'Gestion des utilisateurs',
  subtitle: 'Approuve les nouveaux comptes et gère les accès.',
  filters: {
    all: 'Tous',
    pending: 'Nouveaux',
    active: 'Activés',
    disabled: 'Désactivés',
  },
  status: {
    PENDING: 'Nouveau',
    ACTIVE: 'Actif',
    DISABLED: 'Désactivé',
  },
  role: {
    USER: 'Utilisateur',
    ADMIN: 'Admin',
  },
  joinedOn: 'Inscrit le {{date}}',
  you: 'Toi',
  actions: {
    activate: 'Activer',
    deactivate: 'Désactiver',
    activating: 'Activation…',
    deactivating: 'Désactivation…',
    deactivateConfirm: 'Désactiver {{name}} ? La personne perd l’accès immédiatement (ses données sont conservées).',
  },
  count_one: '{{count}} compte',
  count_other: '{{count}} comptes',
  empty: 'Aucun compte dans cette vue.',
  loadError: 'Impossible de charger les comptes.',
  actionError: "La modification n'a pas pu être enregistrée. Réessaie.",
}
