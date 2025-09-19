"use client";

import React from "react";
import { useSectionAnalytics } from "./hooks/useSectionAnalytics";
import ReportsChart from "./components/ReportsChart";
import KpiGrid from "./components/KpiGrid";
import type { SectionAnalyticsProps } from "./types";

export const SectionAnalytics: React.FC<SectionAnalyticsProps> = ({ sectionId }) => {
  const {
    isLoading,
    error,
    kpis,
    reportsLast7,
    reportsLast7Totals,
    incomingAssignments,
    outgoingAssignments,
    assignmentPlanEventsLast10,
  } = useSectionAnalytics(sectionId);

  if (isLoading) {
    return (
      <div className="w-full h-full bg-gray-50 dark:bg-gray-900 rounded-2xl p-4 text-sm text-muted-foreground flex items-center justify-center">
        Загрузка аналитики раздела…
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full bg-gray-50 dark:bg-gray-900 rounded-2xl p-4 text-sm text-destructive flex items-center justify-center">
        {error}
      </div>
    );
  }

  return (
    <div className="w-full p-0 relative text-gray-900 dark:text-white">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-9">
          <ReportsChart
            reportsLast7={reportsLast7 || []}
            reportsLast7Totals={reportsLast7Totals || []}
            assignmentPlanEventsLast10={assignmentPlanEventsLast10 || []}
          />
        </div>
        <div className="col-span-3">
          <KpiGrid
            currentTotalRate={kpis?.currentTotalRate || 0}
            peopleOnLoadings={kpis?.peopleOnLoadings || 0}
            daysToDeadline={kpis?.daysToDeadline ?? null}
            incomingAssignments={incomingAssignments}
            outgoingAssignments={outgoingAssignments}
          />
        </div>
      </div>
    </div>
  );
};

export default SectionAnalytics;


