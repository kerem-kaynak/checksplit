import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Plus, Minus, Trash2, ScanLine, PenLine, ArrowLeft, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { createCheck } from "@/services/api";
import { CURRENCY_SYMBOLS, type Currency, type ItemCreate, type PaymentMethods } from "@/types";

interface LocationState {
  items?: ItemCreate[];
  currency?: Currency;
}

interface LocalItem {
  name: string;
  quantity: number;
  unit_price: string;
  total_price: string;
  priceMode: "unit" | "total";
}

function normalizePaypalUrl(url: string): string {
  let normalized = url.trim();
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, "");
  // Add https:// if no protocol
  if (!normalized.match(/^https?:\/\//i)) {
    normalized = "https://" + normalized;
  }
  return normalized;
}

function isValidPaypalUrl(url: string): boolean {
  const normalized = normalizePaypalUrl(url);
  return /^https?:\/\/paypal\.me\/[\w-]+$/i.test(normalized);
}

function calculatePrices(item: LocalItem): { unit_price: string; total_price: string } {
  if (item.priceMode === "unit") {
    const unit = parseFloat(item.unit_price) || 0;
    const total = unit * item.quantity;
    return {
      unit_price: item.unit_price,
      total_price: total.toFixed(2),
    };
  } else {
    const total = parseFloat(item.total_price) || 0;
    const unit = item.quantity > 0 ? total / item.quantity : 0;
    return {
      unit_price: unit.toFixed(2),
      total_price: item.total_price,
    };
  }
}

export function CreateCheck() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [step, setStep] = useState<"choose" | "edit">(state?.items ? "edit" : "choose");
  const [items, setItems] = useState<LocalItem[]>([]);
  const [currency, setCurrency] = useState<Currency>(state?.currency || "EUR");
  const [tipAmount, setTipAmount] = useState("");
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Payment methods state
  const [bankEnabled, setBankEnabled] = useState(false);
  const [accountHolder, setAccountHolder] = useState("");
  const [iban, setIban] = useState("");
  const [paypalEnabled, setPaypalEnabled] = useState(false);
  const [paypalUrl, setPaypalUrl] = useState("");
  const [otherEnabled, setOtherEnabled] = useState(false);
  const [otherText, setOtherText] = useState("");

  useEffect(() => {
    if (state?.items) {
      setItems(
        state.items.map((item) => ({
          name: item.name,
          quantity: item.quantity || 1,
          unit_price: item.unit_price || "",
          total_price: item.total_price || "",
          priceMode: item.unit_price ? "unit" : "total",
        }))
      );
      setStep("edit");
    }
    if (state?.currency) {
      setCurrency(state.currency);
    }
  }, [state]);

  const handleAddItem = () => {
    setItems([
      ...items,
      { name: "", quantity: 1, unit_price: "", total_price: "", priceMode: "unit" },
    ]);
  };

  const handleUpdateItem = (index: number, updates: Partial<LocalItem>) => {
    const updated = [...items];
    updated[index] = { ...updated[index], ...updates };
    setItems(updated);
  };

  const handleQuantityChange = (index: number, delta: number) => {
    const item = items[index];
    const newQuantity = Math.max(1, item.quantity + delta);
    handleUpdateItem(index, { quantity: newQuantity });
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    const validItems = items.filter((item) => item.name.trim() && (item.unit_price || item.total_price));
    if (validItems.length === 0) {
      setError("Add at least one item with a name and price");
      return;
    }

    // Validate payment methods
    if (!bankEnabled && !paypalEnabled && !otherEnabled) {
      setError("Add at least one payment method");
      return;
    }

    if (bankEnabled && (!accountHolder.trim() || !iban.trim())) {
      setError("Fill in account holder name and IBAN for bank transfer");
      return;
    }

    if (paypalEnabled) {
      if (!paypalUrl.trim()) {
        setError("Fill in PayPal.me URL");
        return;
      }
      if (!isValidPaypalUrl(paypalUrl)) {
        setError("Invalid PayPal.me URL. It should look like: paypal.me/yourname");
        return;
      }
    }

    if (otherEnabled && !otherText.trim()) {
      setError("Fill in payment instructions");
      return;
    }

    // Build payment methods object
    const paymentMethods: PaymentMethods = {};
    if (bankEnabled) {
      paymentMethods.bank = {
        account_holder: accountHolder.trim(),
        iban: iban.trim().replace(/\s/g, "").toUpperCase(),
      };
    }
    if (paypalEnabled) {
      paymentMethods.paypal = {
        url: normalizePaypalUrl(paypalUrl),
      };
    }
    if (otherEnabled) {
      paymentMethods.other = {
        text: otherText.trim(),
      };
    }

    setIsLoading(true);
    setError(null);
    try {
      const itemsToCreate: ItemCreate[] = validItems.map((item) => {
        const prices = calculatePrices(item);
        return {
          name: item.name.trim(),
          quantity: item.quantity,
          unit_price: prices.unit_price,
        };
      });

      const check = await createCheck({
        title: title.trim() || undefined,
        payment_methods: paymentMethods,
        currency,
        tip_amount: tipAmount || "0",
        items: itemsToCreate,
      });
      navigate(`/check/${check.code}/success`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create check");
    } finally {
      setIsLoading(false);
    }
  };

  const total = items.reduce((sum, item) => {
    const prices = calculatePrices(item);
    return sum + parseFloat(prices.total_price);
  }, 0);
  const tip = parseFloat(tipAmount) || 0;
  const grandTotal = total + tip;

  if (step === "choose") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-8">Create a Checksplit</h1>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <Button
            size="lg"
            className="w-full"
            onClick={() => navigate("/create/scan")}
          >
            <ScanLine className="h-5 w-5 mr-2" />
            Start with a scan
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            onClick={() => {
              setItems([{ name: "", quantity: 1, unit_price: "", total_price: "", priceMode: "unit" }]);
              setStep("edit");
            }}
          >
            <PenLine className="h-5 w-5 mr-2" />
            Start manually
          </Button>
          <Button variant="ghost" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pb-56">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-6">Edit Items</h1>

        <div className="space-y-4 mb-6">
          <div>
            <Label htmlFor="title" className="mb-2 block">
              Title (optional)
            </Label>
            <Input
              id="title"
              placeholder="Dinner at Kerem's"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={255}
            />
          </div>
        </div>

        <div className="mb-6">
          <Label className="mb-3 block">Payment Methods</Label>
          <p className="text-sm text-muted-foreground mb-4">
            Add at least one way for others to pay you back
          </p>

          <div className="space-y-4">
            {/* Bank Transfer */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Checkbox
                    id="bank-enabled"
                    checked={bankEnabled}
                    onCheckedChange={(checked) => setBankEnabled(checked === true)}
                  />
                  <Label htmlFor="bank-enabled" className="font-medium cursor-pointer">
                    Bank Transfer
                  </Label>
                </div>
                {bankEnabled && (
                  <div className="space-y-3 pl-7">
                    <div>
                      <Label htmlFor="account-holder" className="text-sm mb-1 block">
                        Account Holder Name
                      </Label>
                      <Input
                        id="account-holder"
                        placeholder="John Doe"
                        value={accountHolder}
                        onChange={(e) => setAccountHolder(e.target.value)}
                        maxLength={70}
                      />
                    </div>
                    <div>
                      <Label htmlFor="iban" className="text-sm mb-1 block">
                        IBAN
                      </Label>
                      <Input
                        id="iban"
                        placeholder="DE89 3704 0044 0532 0130 00"
                        value={iban}
                        onChange={(e) => setIban(e.target.value)}
                        maxLength={34}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* PayPal */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Checkbox
                    id="paypal-enabled"
                    checked={paypalEnabled}
                    onCheckedChange={(checked) => setPaypalEnabled(checked === true)}
                  />
                  <Label htmlFor="paypal-enabled" className="font-medium cursor-pointer">
                    PayPal
                  </Label>
                </div>
                {paypalEnabled && (
                  <div className="pl-7">
                    <Label htmlFor="paypal-url" className="text-sm mb-1 block">
                      PayPal.me URL
                    </Label>
                    <Input
                      id="paypal-url"
                      placeholder="https://paypal.me/yourname"
                      value={paypalUrl}
                      onChange={(e) => setPaypalUrl(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Find or create your link at{" "}
                      <a
                        href="https://www.paypal.com/myaccount/profile/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline hover:text-foreground"
                      >
                        paypal.com/myaccount/profile
                      </a>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Other */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Checkbox
                    id="other-enabled"
                    checked={otherEnabled}
                    onCheckedChange={(checked) => setOtherEnabled(checked === true)}
                  />
                  <Label htmlFor="other-enabled" className="font-medium cursor-pointer">
                    Other
                  </Label>
                </div>
                {otherEnabled && (
                  <div className="pl-7">
                    <Label htmlFor="other-text" className="text-sm mb-1 block">
                      Payment Instructions
                    </Label>
                    <Input
                      id="other-text"
                      placeholder="Venmo: @yourname, Cash App: $yourname, etc."
                      value={otherText}
                      onChange={(e) => setOtherText(e.target.value)}
                      maxLength={500}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mb-6">
          <Label className="mb-2 block">Currency</Label>
          <div className="flex gap-2">
            {(["EUR", "USD", "TRY"] as Currency[]).map((c) => (
              <Button
                key={c}
                variant={currency === c ? "default" : "outline"}
                size="sm"
                onClick={() => setCurrency(c)}
              >
                {CURRENCY_SYMBOLS[c]} {c}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-4 mb-6">
          {items.map((item, index) => {
            const prices = calculatePrices(item);
            return (
              <Card key={index}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Item name"
                      value={item.name}
                      onChange={(e) => handleUpdateItem(index, { name: e.target.value })}
                      className="flex-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(index)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleQuantityChange(index, -1)}
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center font-medium">{item.quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleQuantityChange(index, 1)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>

                    <span className="text-muted-foreground text-sm">×</span>

                    <div className="flex-1">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                          {CURRENCY_SYMBOLS[currency]}
                        </span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="Unit price"
                          value={item.priceMode === "unit" ? item.unit_price : prices.unit_price}
                          onChange={(e) =>
                            handleUpdateItem(index, {
                              unit_price: e.target.value,
                              priceMode: "unit",
                            })
                          }
                          className="pl-6 h-9 text-sm"
                        />
                      </div>
                    </div>

                    <span className="text-muted-foreground text-sm">=</span>

                    <div className="w-24 text-right">
                      <p className="font-medium">
                        {CURRENCY_SYMBOLS[currency]}{prices.total_price}
                      </p>
                    </div>
                  </div>

                  {item.quantity > 1 && (
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} × {CURRENCY_SYMBOLS[currency]}{prices.unit_price} each
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Button variant="outline" onClick={handleAddItem} className="w-full mb-6">
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>

        <div className="mb-6">
          <Label htmlFor="tip" className="mb-2 block">
            Tip (optional)
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
              {CURRENCY_SYMBOLS[currency]}
            </span>
            <Input
              id="tip"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={tipAmount}
              onChange={(e) => setTipAmount(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        {error && <p className="text-destructive mb-4 text-sm">{error}</p>}

        <Card className="fixed bottom-0 left-0 right-0 rounded-none border-x-0 border-b-0">
          <CardContent className="p-4 max-w-md mx-auto">
            <div className="flex justify-between items-center mb-2 text-sm gap-4">
              <span>Subtotal ({items.length} items)</span>
              <span>
                {CURRENCY_SYMBOLS[currency]}{total.toFixed(2)}
              </span>
            </div>
            {tip > 0 && (
              <div className="flex justify-between items-center mb-2 text-sm gap-4">
                <span>Tip</span>
                <span>
                  {CURRENCY_SYMBOLS[currency]}{tip.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center font-bold mb-4 gap-4">
              <span>Total</span>
              <span>
                {CURRENCY_SYMBOLS[currency]}{grandTotal.toFixed(2)}
              </span>
            </div>
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={isLoading || items.length === 0}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Create a Checksplit
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
