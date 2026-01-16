"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import type { KPIData, ReportDay, AssignmentPlanEvents, ReportDayTotal } from "../types";

interface UseSectionAnalyticsResult {
  isLoading: boolean;
  error: string | null;
  kpis: KPIData | null;
  reportsLast7: ReportDay[] | null;
  reportsLast7Totals: ReportDayTotal[] | null;
  incomingAssignments: number;
  outgoingAssignments: number;
  assignmentPlanEventsLast10: AssignmentPlanEvents[] | null;
}

type ViewSectionAnalyticsRow = {
  section_id: string;
  days_to_deadline: number | null;
  people_on_loadings: number | null;
  current_total_rate: number | null;
  incoming_assignments: number | null;
  outgoing_assignments: number | null;
  reports_last10: ReportDay[] | null;
  reports_last10_totals: ReportDayTotal[] | null;
  assignment_plan_events_last10: AssignmentPlanEvents[] | null;
};

export function useSectionAnalytics(sectionId: string): UseSectionAnalyticsResult {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [reportsLast7, setReportsLast7] = useState<ReportDay[] | null>(null);
  const [reportsLast7Totals, setReportsLast7Totals] = useState<ReportDayTotal[] | null>(null);
  const [incomingAssignments, setIncomingAssignments] = useState<number>(0);
  const [outgoingAssignments, setOutgoingAssignments] = useState<number>(0);
  const [viewDaysToDeadline, setViewDaysToDeadline] = useState<number | null>(null);
  const [viewPeopleOnLoadings, setViewPeopleOnLoadings] = useState<number>(0);
  const [viewCurrentTotalRate, setViewCurrentTotalRate] = useState<number>(0);
  const [assignmentPlanEventsLast10, setAssignmentPlanEventsLast10] = useState<AssignmentPlanEvents[] | null>(null);

  // Таймер для опроса
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (opts?: { showLoading?: boolean }) => {
    if (!sectionId) return;
    const showLoading = opts?.showLoading === true;
    if (showLoading) setIsLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      const { data, error: coreErr } = await supabase
        .from("view_section_analytics")
        .select(
          "section_id, days_to_deadline, reports_last10, reports_last10_totals, assignment_plan_events_last10, people_on_loadings, current_total_rate, incoming_assignments, outgoing_assignments"
        )
        .eq("section_id", sectionId)
        .maybeSingle<ViewSectionAnalyticsRow>();

      if (coreErr) throw new Error(coreErr.message);

      if (data) {
        setReportsLast7(Array.isArray(data.reports_last10) ? data.reports_last10 : []);
        setReportsLast7Totals(Array.isArray(data.reports_last10_totals) ? data.reports_last10_totals : []);
        setIncomingAssignments(Number(data.incoming_assignments || 0));
        setOutgoingAssignments(Number(data.outgoing_assignments || 0));
        setViewDaysToDeadline(data.days_to_deadline ?? null);
        setViewPeopleOnLoadings(Number(data.people_on_loadings || 0));
        setViewCurrentTotalRate(Number(data.current_total_rate || 0));
        setAssignmentPlanEventsLast10(Array.isArray(data.assignment_plan_events_last10) ? data.assignment_plan_events_last10 : []);
      } else {
        setReportsLast7([]);
        setReportsLast7Totals([]);
        setIncomingAssignments(0);
        setOutgoingAssignments(0);
        setViewDaysToDeadline(null);
        setViewPeopleOnLoadings(0);
        setViewCurrentTotalRate(0);
        setAssignmentPlanEventsLast10([]);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Ошибка загрузки данных аналитики раздела";
      setError(message);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, [sectionId]);

  useEffect(() => {
    // Первичная загрузка
    fetchData({ showLoading: true });

    // Опрос данных каждые 3 секунды без состояния загрузки
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(() => {
      // В фоне не опрашиваем, чтобы не грузить сеть/бэкенд
      if (typeof document !== 'undefined' && document.hidden) return;
      fetchData({ showLoading: false });
    }, 3000);

    // Мгновенное обновление при возврате вкладки в фокус
    const handleVisibility = () => {
      if (!document.hidden) fetchData({ showLoading: false });
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, [fetchData]);

  const kpis = useMemo<KPIData | null>(() => ({
    daysToDeadline: viewDaysToDeadline,
    peopleOnLoadings: viewPeopleOnLoadings,
    currentTotalRate: viewCurrentTotalRate,
  }), [viewDaysToDeadline, viewPeopleOnLoadings, viewCurrentTotalRate]);

  return {
    isLoading,
    error,
    kpis,
    reportsLast7,
    reportsLast7Totals,
    incomingAssignments,
    outgoingAssignments,
    assignmentPlanEventsLast10,
  };
}


