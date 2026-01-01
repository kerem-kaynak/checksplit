import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Plus, Minus, Trash2, ScanLine, PenLine, ArrowLeft, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { createCheck } from "@/services/api";
import { CURRENCY_SYMBOLS, type Currency, type ItemCreate } from "@/types";

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
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        description: description.trim() || undefined,
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
        <h1 className="text-2xl font-bold mb-8">Create Checksplit</h1>
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
          <div>
            <Label htmlFor="description" className="mb-2 block">
              Description (optional)
            </Label>
            <Input
              id="description"
              placeholder="IBAN: DE 26 0000..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
            />
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
                  Create Checksplit
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
