// TODO(PLAKY-DASHBOARD): PLAKY-DASH-001 - implement the tracked-percentage metric.
// Contract: percentTracked = round((tracked / graduates) * 100, 2), guarding graduates <= 0.
// The dashboard router surfaces this value and apps/web/src/routes/_app/dashboard.tsx
// displays it, so the rounding rule must be reproduced exactly.
export function percentTracked(graduates: number, tracked: number) {
  if (graduates <= 0) {
    return 0;
  }

  return Math.round((tracked / graduates) * 10000) / 100;
}