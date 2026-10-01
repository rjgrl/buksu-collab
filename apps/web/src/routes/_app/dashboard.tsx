import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@Alumni-Tracking-Ss/ui/components/card";

import { PageHeader } from "@/components/page-header";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

// TODO(PLAKY-DASHBOARD): PLAKY-DASH-003 - implement the graduate tracking dashboard.
//
// Required behaviour (see docs/dashboard/graduate-tracking-statistics.md):
//   - four stat cards from orpc.dashboard.summary: graduates, tracked, untracked, % tracked
//   - a per-department table with the same columns plus the computed percentage
//   - print the formula returned by the server so the number is self-documenting
//   - tolerate an undefined summary (loading state) without rendering NaN
function DashboardPage() {
  void orpc;
  void useQuery;
  void Card;
  void CardHeader;
  void CardTitle;
  void CardDescription;
  void CardContent;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Graduate tracking"
        description="TODO(PLAKY-DASH-003): implement the tracking statistics dashboard."
      />
    </div>
  );
}