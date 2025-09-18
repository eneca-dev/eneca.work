"use client";

import React from "react";
import AnimatedNumber from "./AnimatedNumber";

interface KItemProps { label: string; value: React.ReactNode }

const KItem: React.FC<KItemProps> = ({ label, value }) => (
  <div className="bg-white dark:bg-[rgb(15,23,42)] border border-slate-200 dark:border-white/20 rounded-sm px-3 py-3 min-h-[72px] w-full flex flex-col items-center justify-center text-center shadow-md hover:shadow-lg transition-all duration-300">
    <div className="text-[11px] text-slate-900 dark:text-muted-foreground mb-1">{label}</div>
    <div className="text-lg font-semibold text-slate-900 dark:text-card-foreground leading-none">{value}</div>
  </div>
);

interface KpiGridTwoByThreeProps {
  currentTotalRate: number;
  peopleOnLoadings: number;
  daysToDeadline: number | null;
  incomingAssignments: number;
  outgoingAssignments: number;
}

export const KpiGridTwoByThree: React.FC<KpiGridTwoByThreeProps> = ({
  currentTotalRate,
  peopleOnLoadings,
  daysToDeadline,
  incomingAssignments,
  outgoingAssignments,
}) => {
  const assignmentsValue = (
    <>
      <AnimatedNumber value={incomingAssignments} />
      {" / "}
      <AnimatedNumber value={outgoingAssignments} />
    </>
  );
  const ratePeopleValue = (
    <>
      <AnimatedNumber value={Number.isFinite(currentTotalRate) ? currentTotalRate : 0} />
      {" / "}
      <AnimatedNumber value={peopleOnLoadings} />
    </>
  );
  const daysValue = (
    <>
      {daysToDeadline === null ? "—" : <AnimatedNumber value={daysToDeadline} />}
    </>
  );
  return (
    <div className="grid grid-cols-1 grid-rows-3 gap-2">
      <KItem label="Задания (вход./исх.)" value={assignmentsValue} />
      <KItem label="Ставка / Людей" value={ratePeopleValue} />
      <KItem label="Дней до дедлайна" value={daysValue} />
    </div>
  );
};

export default KpiGridTwoByThree;


