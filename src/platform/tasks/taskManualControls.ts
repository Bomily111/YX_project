/** Manual controls are reserved for the development-only comparison condition. */
export function taskManualControlsEnabled(): boolean {
  return import.meta.env.DEV && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('taskControls') === 'manual'
}
