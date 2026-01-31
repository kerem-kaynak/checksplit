import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, ExternalLink, Loader2, Copy, Check, AlertTriangle } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { CurrencyCombobox } from "@/components/CurrencyCombobox";
import { getCheck, getCheckSummary, getExchangeRate } from "@/services/api";
import { getCurrencySymbol, type Check as CheckType, type CheckSummary } from "@/types";

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
  const [searchParams] = useSearchParams();
  const amount = searchParams.get("amount") || "0";
  const participantName = searchParams.get("name") || "";

  const [check, setCheck] = useState<CheckType | null>(null);
  const [summary, setSummary] = useState<CheckSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState<string | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const qrCanvasRef = useRef<HTMLDivElement>(null);

  // Payment currency state
  const [paymentCurrency, setPaymentCurrency] = useState("EUR");
  const [exchangeRate, setExchangeRate] = useState("1");
  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  // Derived values
  const checkCurrency = check?.currency || "EUR";
  const originalAmount = parseFloat(amount);
  const convertedAmount = (originalAmount * parseFloat(exchangeRate)).toFixed(2);
  const needsConversion = checkCurrency !== paymentCurrency;

  // Fetch exchange rate when payment currency changes
  useEffect(() => {
    if (!check) return;

    if (checkCurrency === paymentCurrency) {
      setExchangeRate("1");
      setRateError(null);
      return;
    }

    async function fetchRate() {
      setIsLoadingRate(true);
      setRateError(null);
      try {
        const response = await getExchangeRate(checkCurrency, paymentCurrency);
        setExchangeRate(response.rate);
      } catch {
        setRateError("Could not fetch exchange rate");
        setExchangeRate("1");
      } finally {
        setIsLoadingRate(false);
      }
    }

    fetchRate();
  }, [check, checkCurrency, paymentCurrency]);

  // Regenerate QR when payment currency or amount changes
  useEffect(() => {
    if (!check?.payment_methods?.bank || paymentCurrency !== "EUR") {
      setQrImageUrl(null);
      return;
    }

    // Small delay to ensure canvas is rendered
    const timer = setTimeout(() => {
      if (!qrCanvasRef.current) return;
      const canvas = qrCanvasRef.current.querySelector("canvas");
      if (canvas) {
        setQrImageUrl(canvas.toDataURL("image/png"));
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [check, paymentCurrency, convertedAmount]);

  useEffect(() => {
    if (!code) return;

    async function loadData() {
      try {
        const [checkData, summaryData] = await Promise.all([
          getCheck(code!),
          getCheckSummary(code!),
        ]);
        setCheck(checkData);
        setSummary(summaryData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load check");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [code]);

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

  if (error || !check) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-destructive mb-4">{error || "Check not found"}</p>
        <Button variant="outline" onClick={() => navigate("/")}>
          Go Home
        </Button>
      </div>
    );
  }

  const paymentMethods = check.payment_methods;
  const checkSymbol = getCurrencySymbol(checkCurrency);
  const paymentSymbol = getCurrencySymbol(paymentCurrency);
  const formattedOriginalAmount = originalAmount.toFixed(2);

  // Amount to use for EUR QR code (convert from check currency to EUR if needed)
  const eurAmount = paymentCurrency === "EUR" ? convertedAmount : formattedOriginalAmount;

  return (
    <div className="min-h-screen p-4 pb-24">
      <div className="max-w-md mx-auto">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => navigate(`/check/${code}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Check
        </Button>

        <h1 className="text-2xl font-bold mb-2">Pay {participantName ? "Your Share" : "Now"}</h1>
        <p className="text-muted-foreground mb-4">
          {participantName && <span className="font-medium">{participantName}, </span>}
          You owe <span className="font-bold text-foreground">{checkSymbol}{formattedOriginalAmount}</span>
          {needsConversion && !isLoadingRate && (
            <span className="text-foreground">
              {" "}({paymentSymbol}{convertedAmount})
            </span>
          )}
        </p>

        {/* Payment Currency Selector */}
        <div className="mb-6">
          <Label className="mb-2 block">Pay in</Label>
          <CurrencyCombobox
            value={paymentCurrency}
            onChange={setPaymentCurrency}
          />
          {isLoadingRate && (
            <p className="text-sm text-muted-foreground mt-2 flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading exchange rate...
            </p>
          )}
          {!isLoadingRate && needsConversion && !rateError && (
            <p className="text-sm text-muted-foreground mt-2">
              {checkSymbol}{formattedOriginalAmount} = {paymentSymbol}{convertedAmount}
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
  {paymentCurrency === "EUR" ? (
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
                <div ref={qrRef} className="flex justify-center bg-white p-4 rounded-lg">
                  {qrImageUrl ? (
                    <img
                      src={qrImageUrl}
                      alt="Payment QR Code"
                      className="w-[200px] h-[200px]"
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
                  className="w-full"
                  onClick={handleDownloadQr}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download QR Code
                </Button>
                </>
                ) : (
                <div className="text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    QR code is only available for EUR payments.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setPaymentCurrency("EUR")}
                  >
                    Switch to EUR
                  </Button>
                </div>
                )}

                <div className="border-t pt-4 space-y-2">
                  <p className="text-sm text-muted-foreground">Or transfer manually:</p>
                  <div className="space-y-1">
                    <p className="text-sm">
                      <span className="text-muted-foreground">To:</span>{" "}
                      <span className="font-medium">{paymentMethods.bank.account_holder}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm flex-1">
                        <span className="text-muted-foreground">IBAN:</span>{" "}
                        <span className="font-mono text-xs">{paymentMethods.bank.iban}</span>
                      </p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
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
                      <span className="font-medium">{paymentSymbol}{convertedAmount}</span>
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
                  className="w-full"
                  onClick={() => {
                    // PayPal.me format: https://paypal.me/username/amountCURRENCY
                    const baseUrl = paymentMethods.paypal!.url.replace(/\/$/, "");
                    const paypalUrl = `${baseUrl}/${convertedAmount}${paymentCurrency}`;
                    window.open(paypalUrl, "_blank");
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Pay {paymentSymbol}{convertedAmount} via PayPal
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
                <p className="text-sm whitespace-pre-wrap">{paymentMethods.other.text}</p>
                <p className="text-sm mt-2">
                  <span className="text-muted-foreground">Amount to pay:</span>{" "}
                  <span className="font-medium">
                    {checkSymbol}{formattedOriginalAmount}
                    {needsConversion && (
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
      </div>
    </div>
  );
}
