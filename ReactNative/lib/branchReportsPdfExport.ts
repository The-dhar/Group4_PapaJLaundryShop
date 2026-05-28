import { Platform } from "react-native";
import type { BranchReportsExportPayload } from "./branchReportsPdfExport.types";

export async function exportBranchReportsPdf(
  payload: BranchReportsExportPayload,
  mode: "download" | "print" = "download"
): Promise<void> {
  if (Platform.OS === "web") {
    const { exportBranchReportsPdf: run } = await import("./branchReportsPdfExport.web");
    await run(payload, mode);
    return;
  }

  const { exportBranchReportsPdf: run } = await import("./branchReportsPdfExport.native");
  await run(payload, mode);
}