export default {
  title: 'User management',
  subtitle: 'Approve new accounts and control who has access.',
  filters: {
    all: 'All',
    pending: 'New',
    active: 'Activated',
    disabled: 'Deactivated',
  },
  status: {
    PENDING: 'New',
    ACTIVE: 'Active',
    DISABLED: 'Deactivated',
  },
  role: {
    USER: 'User',
    ADMIN: 'Admin',
  },
  joinedOn: 'Joined {{date}}',
  you: 'You',
  actions: {
    activate: 'Activate',
    deactivate: 'Deactivate',
    activating: 'Activating…',
    deactivating: 'Deactivating…',
  },
  count_one: '{{count}} account',
  count_other: '{{count}} accounts',
  empty: 'No accounts in this view.',
  loadError: 'Could not load the accounts.',
  actionError: 'The change could not be saved. Try again.',
}
