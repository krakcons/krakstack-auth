// Temporary rollout gate: the consuming app's production build hides deletion UI.
// This is not authorization; deletion endpoints retain their server-side checks.
export const deletionControlsEnabled = import.meta.env.DEV;
