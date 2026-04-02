const ONBOARDING_KEY = 'mf_onboarding_seen'

export function hasCompletedOnboarding(): boolean {
  if (typeof window === 'undefined') return true
  return window.localStorage.getItem(ONBOARDING_KEY) === '1'
}

export function markOnboardingComplete(): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ONBOARDING_KEY, '1')
}
