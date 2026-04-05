/** Fields needed for PDF export (subset of ClerkLog). */
export type ClerkLogPdfRow = {
  receipt_id: string;
  clerk_name: string;
  branch: string;
  customer_name: string;
  amount: number;
  status: string;
  inventory_status: string;
  due_date: string;
};
