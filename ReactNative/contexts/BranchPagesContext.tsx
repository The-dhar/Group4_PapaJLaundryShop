import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type BranchPagesContextValue = {
  branchId: string | null;
  branchName: string | null;
  setBranch: (branchId: string | null, branchName: string | null) => void;
};

const BranchPagesContext = createContext<BranchPagesContextValue | undefined>(undefined);

export function BranchPagesProvider({ children }: { children: React.ReactNode }) {
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);

  const setBranch = useCallback((id: string | null, name: string | null) => {
    setBranchId(id);
    setBranchName(name);
  }, []);

  const value = useMemo(
    () => ({ branchId, branchName, setBranch }),
    [branchId, branchName, setBranch]
  );

  return (
    <BranchPagesContext.Provider value={value}>{children}</BranchPagesContext.Provider>
  );
}

export function useBranchPages() {
  const ctx = useContext(BranchPagesContext);
  if (!ctx) {
    throw new Error("useBranchPages must be used within BranchPagesProvider");
  }
  return ctx;
}
