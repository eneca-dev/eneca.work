"use client";

import * as React from "react";
import { useState, useRef, useCallback } from "react";
import StagesManagement from "./stages-management";
import { ToastProvider, Toaster } from "../hooks/use-toast";
import AddWorkLogModal from "@/modules/projects/components/AddWorkLogModal";

type Props = {
  sectionId: string;
  compact?: boolean;
};

export default function SectionDecomposition2Tab(props: Props) {
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [selectedForLog, setSelectedForLog] = useState<string | null>(null);
  const refreshActualsRef = useRef<(() => void) | null>(null);

  const handleOpenLogModal = (itemId: string) => {
    setSelectedForLog(itemId);
    setIsLogModalOpen(true);
  };

  // Сохраняем функцию обновления фактических часов
  const handleRefreshReady = useCallback((refreshFn: () => void) => {
    refreshActualsRef.current = refreshFn;
  }, []);

  // Вызываем обновление после успешного создания отчета
  const handleLogSuccess = useCallback(() => {
    if (refreshActualsRef.current) {
      refreshActualsRef.current();
    }
  }, []);

  return (
    <ToastProvider>
      <div className="pt-0 px-2 pb-2">
        <StagesManagement
          sectionId={props.sectionId}
          onOpenLog={handleOpenLogModal}
          onRefreshReady={handleRefreshReady}
        />
      </div>
      <Toaster />

      <AddWorkLogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        sectionId={props.sectionId}
        defaultItemId={selectedForLog}
        onSuccess={handleLogSuccess}
        key={isLogModalOpen ? `add-log-${selectedForLog || 'none'}` : 'add-log-hidden'}
      />
    </ToastProvider>
  );
}


