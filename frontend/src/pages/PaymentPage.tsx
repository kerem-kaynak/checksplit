import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, ExternalLink, Loader2, Copy, Check, AlertTriangle } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCheck, getCheckSummary } from "@/services/api";
import { CURRENCY_SYMBOLS, type Check as CheckType, type CheckSummary, type Currency } from "@/types";

function generateEpcQrCode(
  accountHolder: string,
  iban: string,
  amount: string,
  currency: Currency,
  reference?: string
): string {
  // EPC QR code format (version 002)
  // https://www.europeanpaymentscouncil.eu/sites/default/files/kb/file/2022-09/EPC069-12%20v3.0%20Quick%20Response%20Code%20-%20Guidelines%20to%20Enable%20Data%20Capture%20for%20the%20Initiation%20of%20an%20SCT_0.pdf
  const lines = [
    "BCD",                          // Service Tag
    "002",                          // Version
    "1",                            // Character set (UTF-8)
    "SCT",                          // Identification (SEPA Credit Transfer)
    "",                             // BIC (optional for domestic)
    accountHolder.substring(0, 70), // Beneficiary Name (max 70)
    iban.replace(/\s/g, ""),        // IBAN
    `${currency}${parseFloat(amount).toFixed(2)}`, // Amount
    "",                             // Purpose code (optional)
    reference?.substring(0, 35) || "", // Remittance reference (max 35)
    "",                             // Remittance text (optional)
    "",                             // Beneficiary to originator info (optional)
  ];
  return lines.join("\n");
}

function getCurrencyCode(currency: Currency): string {
  // PayPal uses ISO currency codes
  return currency;
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
  const qrRef = useRef<HTMLDivElement>(null);

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
    if (!qrRef.current) return;

    const svg = qrRef.current.querySelector("svg");
    if (!svg) return;

    // Create canvas from SVG
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();

    img.onload = async () => {
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Try to use Web Share API (works on iOS, shows "Save Image" option)
      if (typeof navigator.canShare === "function" && typeof navigator.share === "function") {
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

      // Fallback: direct download
      const link = document.createElement("a");
      link.download = `payment-${code}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
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
  const currencySymbol = CURRENCY_SYMBOLS[check.currency];
  const formattedAmount = parseFloat(amount).toFixed(2);

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
        <p className="text-muted-foreground mb-6">
          {participantName && <span className="font-medium">{participantName}, </span>}
          You owe <span className="font-bold text-foreground">{currencySymbol}{formattedAmount}</span>
        </p>

        {summary && parseFloat(summary.unclaimed_total) > 0 && (
          <div className="bg-destructive/10 border-2 border-destructive/30 rounded-lg p-3 mb-6">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <p className="text-sm font-bold text-destructive">You are most likely paying the wrong amount!</p>
            </div>
            <p className="text-sm text-muted-foreground">
              There are still {currencySymbol}{summary.unclaimed_total} worth of unclaimed items.
              Make sure everyone has claimed their items before paying. With unclaimed items, the calculation of your share is likely to be wrong because of tip sharing.
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
          {/* Bank Transfer with QR Code */}
          {paymentMethods?.bank && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Bank Transfer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div ref={qrRef} className="flex justify-center bg-white p-4 rounded-lg">
                  <QRCodeSVG
                    value={generateEpcQrCode(
                      paymentMethods.bank.account_holder,
                      paymentMethods.bank.iban,
                      formattedAmount,
                      check.currency,
                      check.title || `Checksplit ${code}`
                    )}
                    size={200}
                    level="M"
                  />
                </div>
                <p className="text-sm text-center text-muted-foreground">
                  Scan this QR code with your banking app to pay instantly
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleDownloadQr}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download QR Code
                </Button>

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
                      <span className="font-medium">{currencySymbol}{formattedAmount}</span>
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
              <CardContent>
                <Button
                  className="w-full"
                  onClick={() => {
                    // PayPal.me format: https://paypal.me/username/amount
                    const baseUrl = paymentMethods.paypal!.url.replace(/\/$/, "");
                    const paypalUrl = `${baseUrl}/${formattedAmount}${getCurrencyCode(check.currency)}`;
                    window.open(paypalUrl, "_blank");
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Pay {currencySymbol}{formattedAmount} via PayPal
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
                  <span className="font-medium">{currencySymbol}{formattedAmount}</span>
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
