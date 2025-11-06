"use client";

import * as React from "react";
import StagesManagement from "./stages-management";
import { ToastProvider, Toaster } from "../hooks/use-toast";

type Props = {
  sectionId: string;
  compact?: boolean;
};

export default function SectionDecomposition2Tab(props: Props) {
  return (
    <ToastProvider>
      <div className="pt-0 px-2 pb-2">
        <StagesManagement sectionId={props.sectionId} />
      </div>
      <Toaster />
    </ToastProvider>
  );
}


