import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Minus, Trash2, ArrowLeft, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CurrencyCombobox } from "@/components/CurrencyCombobox";
import { getCheck, updateCheck } from "@/services/api";
import { getCurrencySymbol, type Currency, type ItemCreate, type Check } from "@/types";

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

export function EditCheck() {
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();

  const [check, setCheck] = useState<Check | null>(null);
  const [items, setItems] = useState<LocalItem[]>([]);
  const [currency, setCurrency] = useState<Currency>("EUR");
  const [tipAmount, setTipAmount] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;

    const loadCheck = async () => {
      try {
        const checkData = await getCheck(code);
        setCheck(checkData);
        setCurrency(checkData.currency);
        setTipAmount(checkData.tip_amount);
        setItems(
          checkData.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            priceMode: "unit" as const,
          }))
        );
      } catch {
        setError("Failed to load check");
      } finally {
        setIsLoading(false);
      }
    };

    loadCheck();
  }, [code]);

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
    if (!code) return;

    const validItems = items.filter((item) => item.name.trim() && (item.unit_price || item.total_price));
    if (validItems.length === 0) {
      setError("Add at least one item with a name and price");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const itemsToUpdate: ItemCreate[] = validItems.map((item) => {
        const prices = calculatePrices(item);
        return {
          name: item.name.trim(),
          quantity: item.quantity,
          unit_price: prices.unit_price,
        };
      });

      await updateCheck(code, {
        currency,
        tip_amount: tipAmount || "0",
        items: itemsToUpdate,
      });
      navigate(`/check/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update check");
    } finally {
      setIsSaving(false);
    }
  };

  const total = items.reduce((sum, item) => {
    const prices = calculatePrices(item);
    return sum + parseFloat(prices.total_price);
  }, 0);
  const tip = parseFloat(tipAmount) || 0;
  const grandTotal = total + tip;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !check) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Go Back
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pb-56">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/check/${code}`)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Edit Items</h1>
        </div>

        <div className="mb-6">
          <Label className="mb-2 block">Currency</Label>
          <CurrencyCombobox
            value={currency}
            onChange={(c) => setCurrency(c)}
          />
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
                          {getCurrencySymbol(currency)}
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
                        {getCurrencySymbol(currency)}{prices.total_price}
                      </p>
                    </div>
                  </div>

                  {item.quantity > 1 && (
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} × {getCurrencySymbol(currency)}{prices.unit_price} each
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
              {getCurrencySymbol(currency)}
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
                {getCurrencySymbol(currency)}{total.toFixed(2)}
              </span>
            </div>
            {tip > 0 && (
              <div className="flex justify-between items-center mb-2 text-sm gap-4">
                <span>Tip</span>
                <span>
                  {getCurrencySymbol(currency)}{tip.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center font-bold mb-4 gap-4">
              <span>Total</span>
              <span>
                {getCurrencySymbol(currency)}{grandTotal.toFixed(2)}
              </span>
            </div>
            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={isSaving || items.length === 0}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
