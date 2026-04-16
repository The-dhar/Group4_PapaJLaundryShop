/** Structured row used by both Excel and PDF export builders. */
export type ClerkLogPdfRow = {
  row_no: number;
  receipt_id: string;
  created_at: string;
  clerk_name: string;
  branch: string;
  customer_name: string;
  amount: number;
  status: string;
  inventory_status: string;
  due_date: string;
};

/** Metadata shown in export headers so downloaded files reflect active filters. */
export type ClerkLogsExportContext = {
  generated_at: string;
  requested_by: string;
  branch_label: string;
  date_range_label: string;
  payment_label: string;
  inventory_label: string;
  include_archived_label: string;
  total_rows: number;
  total_amount: number;
};
