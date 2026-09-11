import { useState, useEffect, useRef } from "react";
import { Navigate, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, ExternalLink, Loader2, Copy, Check, AlertTriangle } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CurrencyCombobox } from "@/components/CurrencyCombobox";
import { getExchangeRate } from "@/services/api";
import { getCurrencySymbol } from "@/types";
import { useCheckSummary } from "@/hooks/useCheckSummary";
import { getParticipantName } from "@/lib/participant";
import { BottomBar } from "@/components/BottomBar";
import { PaymentActions } from "@/components/PaymentActions";

function generateEpcQrCode(
  accountHolder: string,
  iban: string,
  amount: string,
  reference?: string
): string {
  // EPC QR code format (version 002) - always EUR for SEPA
  // https://www.europeanpaymentscouncil.eu/sites/default/files/kb/file/2022-09/EPC069-12%20v3.0%20Quick%20Response%20Code%20-%20Guidelines%20to%20Enable%20Data%20Capture%20for%20the%20Initiation%20of%20an%20SCT_0.pdf
  const lines = [
    "BCD",                          // Service Tag
    "002",                          // Version
    "1",                            // Character set (UTF-8)
    "SCT",                          // Identification (SEPA Credit Transfer)
    "",                             // BIC (optional for domestic)
    accountHolder.substring(0, 70), // Beneficiary Name (max 70)
    iban.replace(/\s/g, ""),        // IBAN
    `EUR${parseFloat(amount).toFixed(2)}`, // Amount always in EUR for SEPA
    "",                             // Purpose code (optional)
    reference?.substring(0, 35) || "", // Remittance reference (max 35)
    "",                             // Remittance text (optional)
    "",                             // Beneficiary to originator info (optional)
  ];
  return lines.join("\n");
}

export function PaymentPage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const participantName = code ? getParticipantName(code) : null;
  const { summary, error, isLoading, isUpdating, refresh, mutate } = useCheckSummary(code);
  const check = summary?.check;
  const myParticipant = summary?.participants.find((p) => p.name === participantName);
  const [copied, setCopied] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  // Payment currency state
  const [paymentCurrency, setPaymentCurrency] = useState("EUR");
  const [rateQuote, setRateQuote] = useState<{ from: string; to: string; rate: string | null; error: string | null } | null>(null);

  // Derived values
  const checkCurrency = check?.currency || "";
  const originalAmount = Number(myParticipant?.total || 0);
  const isPaid = myParticipant?.payment_status === "paid";
  const needsReview = myParticipant?.payment_status === "needs_review";
  const currencyChanged = needsReview && myParticipant.paid_currency !== checkCurrency;
  const paymentAmount = needsReview && !currencyChanged
    ? Math.max(0, originalAmount - Number(myParticipant.paid_amount))
    : originalAmount;
  const showPaymentMethods = Boolean(myParticipant && !currencyChanged && paymentAmount > 0);
  const needsConversion = Boolean(checkCurrency && checkCurrency !== paymentCurrency);
  const quoteMatches = rateQuote?.from === checkCurrency && rateQuote.to === paymentCurrency;
  const exchangeRate = needsConversion ? (quoteMatches ? rateQuote.rate : null) : "1";
  const convertedAmount = exchangeRate ? (paymentAmount * Number(exchangeRate)).toFixed(2) : "";
  const isLoadingRate = needsConversion && !quoteMatches;
  const rateError = quoteMatches ? rateQuote.error : null;
  const bankAccount = check?.payment_methods?.bank;

  // Fetch exchange rate when payment currency changes
  useEffect(() => {
    if (!checkCurrency || checkCurrency === paymentCurrency || !showPaymentMethods) return;
    let active = true;

    async function fetchRate() {
      try {
        const response = await getExchangeRate(checkCurrency, paymentCurrency);
        if (active) setRateQuote({ from: checkCurrency, to: paymentCurrency, rate: response.rate, error: null });
      } catch {
        if (active) setRateQuote({ from: checkCurrency, to: paymentCurrency, rate: null, error: "Could not fetch exchange rate. Choose the check currency to continue." });
      }
    }

    fetchRate();
    return () => { active = false; };
  }, [checkCurrency, paymentCurrency, showPaymentMethods]);

  // Regenerate QR when payment currency or amount changes
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const canvas = qrCanvasRef.current?.querySelector("canvas");
      setQrImageUrl(canvas?.toDataURL("image/png") || null);
    });
    return () => cancelAnimationFrame(frame);
  }, [bankAccount?.account_holder, bankAccount?.iban, check?.title, paymentCurrency, convertedAmount, showPaymentMethods]);

  const handleDownloadQr = async () => {
    if (!qrCanvasRef.current) return;

    const canvas = qrCanvasRef.current.querySelector("canvas");
    if (!canvas) return;

    // Detect iOS for Web Share API (works best on iOS)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

    // On iOS, use Web Share API which has "Save Image" option
    if (isIOS && typeof navigator.canShare === "function" && typeof navigator.share === "function") {
      try {
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => resolve(b!), "image/png");
        });
        const file = new File([blob], `payment-${code}.png`, { type: "image/png" });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: "Payment QR Code",
          });
          return;
        }
      } catch (err) {
        // User cancelled or share failed, fall through to download
        if ((err as Error).name === "AbortError") return;
      }
    }

    // Fallback: direct download (for desktop and Android)
    const link = document.createElement("a");
    link.download = `payment-${code}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const handleCopyIban = async (iban: string) => {
    try {
      await navigator.clipboard.writeText(iban);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = iban;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!check) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-destructive mb-4">{error || "Check not found"}</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          Go Home
        </Button>
      </div>
    );
  }

  if (!participantName) return <Navigate to={`/check/${code}`} replace />;

  const paymentMethods = check.payment_methods;
  const checkSymbol = getCurrencySymbol(checkCurrency);
  const paymentSymbol = getCurrencySymbol(paymentCurrency);
  const formattedOriginalAmount = originalAmount.toFixed(2);

  // Amount to use for EUR QR code (convert from check currency to EUR if needed)
  const eurAmount = convertedAmount;

  return (
    <div className="min-h-screen p-4">
      <div className="max-w-md mx-auto">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 min-h-12"
          onClick={() => navigate(`/check/${code}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Check
        </Button>

        <h1 className="text-2xl font-bold mb-2">Your payment</h1>
        <p className="text-muted-foreground break-words">{participantName}, your share including tip</p>
        <p className="text-4xl font-bold tabular-nums break-all mt-3 mb-6">{checkSymbol}{formattedOriginalAmount}</p>

        {error && (
          <div role="alert" className="mb-4 space-y-2">
            <p className="text-sm text-destructive">Could not refresh this check. Check your connection and try again.</p>
            <Button variant="outline" className="min-h-12" onClick={() => void refresh()}>Refresh</Button>
          </div>
        )}

        {!myParticipant && <p className="my-6 text-muted-foreground">Go back to the check and claim your items before marking your share as paid.</p>}

        {needsReview && (
          <div className="my-6 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <p className="font-medium">Review your updated share</p>
            <p>Previously marked {getCurrencySymbol(myParticipant.paid_currency!)}{myParticipant.paid_amount} as paid.</p>
            <p>{currencyChanged ? "The check currency changed. Agree the amount with the recipient before making another payment." : paymentAmount > 0 ? `Remaining to settle: ${checkSymbol}${paymentAmount.toFixed(2)}. The payment options below use this difference.` : "Your share decreased. Review the difference with the recipient before confirming."}</p>
          </div>
        )}

        {showPaymentMethods && <>
        {/* Payment Currency Selector */}
        <div className="mb-6">
          <Label className="mb-2 block">Pay in</Label>
          <CurrencyCombobox
            value={paymentCurrency}
            onChange={setPaymentCurrency}
            className="h-auto min-h-12 whitespace-normal text-left"
          />
          {isLoadingRate && (
            <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading exchange rate...
            </p>
          )}
          {!isLoadingRate && needsConversion && !rateError && exchangeRate && (
            <p className="text-sm text-muted-foreground mt-2">
              {checkSymbol}{paymentAmount.toFixed(2)} = {paymentSymbol}{convertedAmount}
              <span className="text-xs ml-1">(rate: {exchangeRate})</span>
            </p>
          )}
          {rateError && (
            <p className="text-sm text-destructive mt-2">{rateError}</p>
          )}
        </div>

        {summary && parseFloat(summary.unclaimed_total) > 0 && (
          <div className="bg-yellow-500/10 border-2 border-yellow-500/30 rounded-lg p-3 mb-6">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <p className="text-sm font-bold text-yellow-600">There are unclaimed items</p>
            </div>
            <p className="text-sm text-muted-foreground">
              If you shared an item with someone who hasn't claimed yet, your total may be incorrect.
            </p>
          </div>
        )}

        {!paymentMethods && (
          <Card>
            <CardContent className="p-4 text-center text-muted-foreground">
              No payment methods configured for this check.
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          {/* Bank Transfer */}
          {paymentMethods?.bank && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Bank Transfer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
  {paymentCurrency === "EUR" && convertedAmount ? (
                <>
                {/* Hidden canvas for generating QR */}
                <div ref={qrCanvasRef} className="hidden">
                  <QRCodeCanvas
                    value={generateEpcQrCode(
                      paymentMethods.bank.account_holder,
                      paymentMethods.bank.iban,
                      eurAmount,
                      check.title || `Checksplit ${code}`
                    )}
                    size={400}
                    level="M"
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground/70">
                  If the download button doesn't work, you can long-press the QR code to save it.
                </p>
                {/* Displayed image - can be long-pressed to save on mobile */}
                <div className="flex justify-center bg-white p-4 rounded-lg">
                  {qrImageUrl ? (
                    <img
                      src={qrImageUrl}
                      alt="Payment QR Code"
                      className="w-[200px] max-w-full aspect-square"
                    />
                  ) : (
                    <div className="w-[200px] h-[200px] flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
                <p className="text-sm text-center text-muted-foreground">
                  Scan this QR code with your banking app to pay instantly. This is a SEPA QR code and only works with European banks that support it.
                </p>
                <Button
                  variant="outline"
                  className="w-full min-h-12"
                  onClick={handleDownloadQr}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download QR Code
                </Button>
                </>
                ) : (
                <div className="text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {paymentCurrency === "EUR" ? "A current exchange rate is needed to generate the payment QR code." : "QR code is only available for EUR payments."}
                  </p>
                  {paymentCurrency !== "EUR" && <Button
                    variant="outline"
                    className="min-h-12"
                    onClick={() => setPaymentCurrency("EUR")}
                  >
                    Switch to EUR
                  </Button>}
                </div>
                )}

                <div className="border-t pt-4 space-y-2">
                  <p className="text-sm text-muted-foreground">Or transfer manually:</p>
                  <div className="space-y-1">
                    <p className="text-sm break-words">
                      <span className="text-muted-foreground">To:</span>{" "}
                      <span className="font-medium">{paymentMethods.bank.account_holder}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm flex-1 min-w-0 break-all">
                        <span className="text-muted-foreground">IBAN:</span>{" "}
                        <span className="font-mono text-xs">{paymentMethods.bank.iban}</span>
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-12 w-12 shrink-0"
                        aria-label="Copy IBAN"
                        onClick={() => handleCopyIban(paymentMethods.bank!.iban)}
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-sm">
                      <span className="text-muted-foreground">Amount:</span>{" "}
                      <span className="font-medium">{convertedAmount ? `${paymentSymbol}${convertedAmount}` : "Waiting for exchange rate"}</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* PayPal */}
          {paymentMethods?.paypal && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">PayPal</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  On a computer, the amount will be pre-filled. On mobile, you may need to enter the amount ({paymentSymbol}{convertedAmount}) manually.
                </p>
                <Button
                  className="w-full min-h-12 h-auto whitespace-normal"
                  disabled={!convertedAmount || Boolean(error)}
                  onClick={() => {
                    // PayPal.me format: https://paypal.me/username/amountCURRENCY
                    const baseUrl = paymentMethods.paypal!.url.replace(/\/$/, "");
                    const paypalUrl = isPaid ? baseUrl : `${baseUrl}/${convertedAmount}${paymentCurrency}`;
                    window.open(paypalUrl, "_blank");
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  {isPaid ? "Open PayPal" : convertedAmount ? `Pay ${paymentSymbol}${convertedAmount} via PayPal` : "Waiting for exchange rate"}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Other Payment Method */}
          {paymentMethods?.other && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Other Payment Options</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap break-words">{paymentMethods.other.text}</p>
                <p className="text-sm mt-2">
                  <span className="text-muted-foreground">Your share:</span>{" "}
                  <span className="font-medium">
                    {checkSymbol}{paymentAmount.toFixed(2)}
                    {needsConversion && convertedAmount && (
                      <span className="text-muted-foreground">
                        {" "}({paymentSymbol}{convertedAmount})
                      </span>
                    )}
                  </span>
                </p>
              </CardContent>
            </Card>
          )}
        </div>
        </>}
      </div>
      {myParticipant && code && (
        <BottomBar>
          <PaymentActions code={code} currency={checkCurrency} participant={myParticipant} disabled={isUpdating || Boolean(error)} mutate={mutate} />
        </BottomBar>
      )}
    </div>
  );
}
