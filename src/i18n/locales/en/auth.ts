export default {
  login: {
    title: 'Sign in',
    subtitle: 'Welcome back to the trails.',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
    submitting: 'Signing in…',
    noAccount: 'No account yet?',
    createOne: 'Create one',
    errors: {
      emailInvalid: 'Invalid email address',
      passwordRequired: 'Password required',
    },
  },
  register: {
    title: 'Create an account',
    subtitle: 'Run free. Train with intention.',
    email: 'Email',
    password: 'Password',
    displayName: 'Display name',
    submit: 'Create my account',
    haveAccount: 'Already have an account?',
    signIn: 'Sign in',
    errors: {
      emailInvalid: 'Invalid email address',
      passwordMin: 'At least 8 characters',
      passwordMax: 'At most 72 characters',
      nameRequired: 'Name is required',
    },
  },
  onboarding: {
    title: 'Welcome to Cavale 🏔',
    intro: 'Two minutes to personalize your training — everything stays editable in your profile.',
    profile: {
      title: 'Your athlete profile',
      intro: 'Weight, HR and birth date feed the statistics and the effort estimation.',
      displayName: 'Display name',
      weight: 'Weight (kg)',
      height: 'Height (cm)',
      birthDate: 'Birth date',
      maxHr: 'Max HR',
      restingHr: 'Resting HR',
    },
    usage: {
      title: 'You use Cavale for…',
      runningOnly: {
        title: 'Running only',
        description:
          'Plans, calendar, Strava and statistics. Strength can still be enabled later in the settings.',
      },
      runningAndGym: {
        title: 'Running + strength',
        description:
          'Everything, plus strength programs, gym session tracking and their statistics.',
      },
    },
    submit: "Let's go",
    later: 'Later',
  },
  stravaCallback: {
    connecting: 'Signing in…',
    cancelledTitle: 'Strava sign-in cancelled',
    cancelledBody: "The authorization didn't go through. You can try again or sign in with email.",
    backToLogin: 'Back to sign in',
  },
  strava: {
    continue: 'Continue with Strava',
    redirecting: 'Redirecting…',
    notConfigured: 'The Strava integration is not configured on this server yet.',
    unavailable: 'Strava sign-in unavailable. Try again.',
    orEmail: 'or with email',
  },
  demo: {
    cta: 'Explore the live demo',
    starting: 'Preparing your demo…',
    error: 'The demo is momentarily unavailable — please try again.',
    orDemo: 'just exploring?',
  },
  devLogin: {
    title: 'Dev environment',
    emailPlaceholder: 'account email',
    submit: 'Enter',
    submitting: 'Signing in…',
  },
  pending: {
    pendingTitle: 'Account awaiting approval',
    pendingBody:
      'Your account has been created. An administrator needs to activate it before you can start training — you’ll get in as soon as it’s approved.',
    disabledTitle: 'Account deactivated',
    disabledBody:
      'Your access has been turned off. Reach out to an administrator if you think this is a mistake.',
    signedInAs: 'Signed in as {{email}}',
    recheck: 'Check again',
    signOut: 'Sign out',
  },
}
