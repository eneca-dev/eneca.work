"use client";

import * as React from "react";
import StagesManagement from "./stages-management";
import { ToastProvider, Toaster } from "../hooks/use-toast";

type Props = {
  sectionId: string;
  compact?: boolean;
};

export default function SectionDecomposition2Tab(_props: Props) {
  return (
    <ToastProvider>
      <div className="p-2">
        <StagesManagement />
      </div>
      <Toaster />
    </ToastProvider>
  );
}


