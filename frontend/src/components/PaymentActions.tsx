import { useRef, useState } from "react";
import { CheckCircle2, Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError, updatePayment } from "@/services/api";
import { getCurrencySymbol, type CheckSummary, type ParticipantSummary } from "@/types";

interface PaymentActionsProps {
  code: string;
  currency: string;
  participant: ParticipantSummary;
  disabled: boolean;
  mutate: (operation: () => Promise<CheckSummary>) => Promise<void>;
}

export function PaymentActions({ code, currency, participant, disabled, mutate }: PaymentActionsProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const actionRef = useRef<HTMLButtonElement>(null);
  const paid = participant.payment_status === "paid";
  const needsReview = participant.payment_status === "needs_review";
  const hasPayment = participant.paid_at !== null;

  const handlePayment = async (nextPaid: boolean) => {
    if (disabled || busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      await mutate(() => updatePayment(code, {
        participant_name: participant.name,
        paid: nextPaid,
        expected_total: participant.total,
        expected_currency: currency,
      }));
      requestAnimationFrame(() => actionRef.current?.focus({ preventScroll: true }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your payment status. Check your connection and try again.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  };

  return (
    <div className="space-y-2" aria-busy={pending}>
      <span className="sr-only" role="status">{pending ? "Saving payment status" : paid ? "Payment marked as paid" : needsReview ? "Payment needs review" : "Payment not marked as paid"}</span>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {needsReview && (
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Your share changed. Previously marked {getCurrencySymbol(participant.paid_currency!)}{participant.paid_amount} as paid.
          {" "}Settle any difference before confirming the updated share.
        </p>
      )}
      {paid ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex min-w-0 flex-1 items-center gap-2 text-base font-medium text-green-800 dark:text-green-200">
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>Your share is paid</span>
          </p>
          <Button ref={actionRef} variant="outline" className="h-auto min-h-12 whitespace-normal" disabled={disabled || pending} onClick={() => handlePayment(false)}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Undo2 aria-hidden="true" />}
            Undo
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button ref={actionRef} className="h-auto min-h-12 w-full whitespace-normal" disabled={disabled || pending || Number(participant.total) <= 0} onClick={() => handlePayment(true)}>
            {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 aria-hidden="true" />}
            {pending ? "Saving…" : needsReview ? "Mark updated share as paid" : "Mark as paid"}
          </Button>
          {hasPayment && (
            <Button variant="outline" className="h-auto min-h-12 w-full" disabled={disabled || pending} onClick={() => handlePayment(false)}>
              <Undo2 aria-hidden="true" />
              Undo
            </Button>
          )}
        </div>
      )}
      {!paid && !needsReview && (
        <p className="text-center text-xs text-muted-foreground">
          Tap after paying your share. This records your payment; it doesn’t transfer money.
        </p>
      )}
    </div>
  );
}
