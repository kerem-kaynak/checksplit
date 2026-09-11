import { AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ParticipantSummary } from "@/types";

export function PaymentStatus({ status }: { status: ParticipantSummary["payment_status"] }) {
  const classes = status === "paid"
    ? "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200"
    : status === "needs_review"
      ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
      : "bg-muted text-muted-foreground";

  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${classes}`}>
      {status === "paid" && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
      {status === "needs_review" && <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
      {status === "paid" ? "Paid" : status === "needs_review" ? "Needs review" : "Not paid"}
    </span>
  );
}
