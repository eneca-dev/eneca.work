import type { Metadata } from "next"
import { UserReportForm } from "@/components/user-report-form"

export const metadata: Metadata = {
  title: "Сообщить о проблеме | eneca.work",
  description: "Форма для отправки отчетов о проблемах и предложений",
}

export default function ReportPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-center">
        <UserReportForm />
      </div>
    </div>
  )
} 