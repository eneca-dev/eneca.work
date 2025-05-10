import type { ExecutorCategory } from "@/types/project-types"

// Interface for plan data
export interface PlanData {
  sectionId: string
  sectionName: string
  category: ExecutorCategory
  startDate: Date
  endDate: Date
  rate: number
}

// Helper to create dates relative to today
const daysFromNow = (days: number): Date => {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

// Mock plan data for different sections
export const mockPlanData: PlanData[] = [
  // 1. ОПЗ 03/25-С load plans
  {
    sectionId: "e1564c10-61c7-42e3-811e-bb036725927d",
    sectionName: "1. ОПЗ 03/25-С",
    category: "К1",
    startDate: daysFromNow(-10),
    endDate: daysFromNow(5),
    rate: 1,
  },
  {
    sectionId: "e1564c10-61c7-42e3-811e-bb036725927d",
    sectionName: "1. ОПЗ 03/25-С",
    category: "ГС1",
    startDate: daysFromNow(-7),
    endDate: daysFromNow(3),
    rate: 1,
  },
  {
    sectionId: "e1564c10-61c7-42e3-811e-bb036725927d",
    sectionName: "1. ОПЗ 03/25-С",
    category: "ВС1",
    startDate: daysFromNow(-5),
    endDate: daysFromNow(8),
    rate: 1,
  },

  // 2. ТХ 03/25-С load plans
  {
    sectionId: "3f4f07b7-9add-4833-8afb-9f8f0c6b847a",
    sectionName: "2. ТХ 03/25-С",
    category: "К1",
    startDate: daysFromNow(-5),
    endDate: daysFromNow(10),
    rate: 1,
  },
  {
    sectionId: "3f4f07b7-9add-4833-8afb-9f8f0c6b847a",
    sectionName: "2. ТХ 03/25-С",
    category: "ВС1",
    startDate: daysFromNow(-3),
    endDate: daysFromNow(12),
    rate: 1,
  },
  {
    sectionId: "3f4f07b7-9add-4833-8afb-9f8f0c6b847a",
    sectionName: "2. ТХ 03/25-С",
    category: "ГС1",
    startDate: daysFromNow(2),
    endDate: daysFromNow(14),
    rate: 1,
  },

  // 3. КР 03/25-С load plans
  {
    sectionId: "de319027-b5f6-40b0-977c-d62ec2bd4f82",
    sectionName: "3. КР 03/25-С",
    category: "К1",
    startDate: daysFromNow(5),
    endDate: daysFromNow(20),
    rate: 1,
  },
  {
    sectionId: "de319027-b5f6-40b0-977c-d62ec2bd4f82",
    sectionName: "3. КР 03/25-С",
    category: "ГС1",
    startDate: daysFromNow(7),
    endDate: daysFromNow(22),
    rate: 1,
  },
  {
    sectionId: "de319027-b5f6-40b0-977c-d62ec2bd4f82",
    sectionName: "3. КР 03/25-С",
    category: "ВС1",
    startDate: daysFromNow(9),
    endDate: daysFromNow(25),
    rate: 2,
  },
]

