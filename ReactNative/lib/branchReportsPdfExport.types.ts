export type BranchReportsTrendSeries = {
  labels: string[];
  resolved?: number[];
  unresolved?: number[];
  paid?: number[];
  unpaid?: number[];
  revenue?: number[];
  losses?: number[];
  profit?: number[];
  newCustomers?: number[];
  returningCustomers?: number[];
};

export type BranchReportsLossReasonSeries = {
  refund: {
    labels: string[];
    values: number[];
  };
  backjob: {
    labels: string[];
    values: number[];
  };
};

export type BranchReportsServiceItemRow = {
  name: string;
  amount: number;
};

export type BranchReportsRecentTransactionRow = {
  receipt: string;
  customer: string;
  payment: string;
  status: string;
  amount: number;
  date: string;
};

export type BranchReportsPerformanceRow = {
  name: string;
  revenue: number;
  unpaid: number;
  disputes: number;
  losses: number;
  profit: number;
  rush: number;
  regular: number;
};

export type BranchReportsExportPayload = {
  generatedAt: string;
  branchName: string;
  branchId: string;
  viewTypeLabel: string;
  rangeStartDate: string;
  rangeEndDate: string;
  totalRevenue: number;
  totalLosses: number;
  netProfit: number;
  totalDisputeValue: number;
  totalWeightProcessed: number;
  issueStatusTrend: BranchReportsTrendSeries;
  paymentTrend: BranchReportsTrendSeries;
  performanceRows: BranchReportsPerformanceRow[];
  growthSeries: BranchReportsTrendSeries;
  lossReasonSeries: BranchReportsLossReasonSeries;
  whiteVsColored: {
    labels: string[];
    values: number[];
  };
  serviceItems: BranchReportsServiceItemRow[];
  recentTransactions: BranchReportsRecentTransactionRow[];
};