import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, RefreshCw, ShoppingCart, PieChart, Home, ArrowRight, Loader2, User, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { getCheck, claimSubItem, getCheckSummary } from "@/services/api";
import { CURRENCY_SYMBOLS, type Check, type CheckSummary, type Item } from "@/types";

function getStoredName(code: string): string | null {
  return localStorage.getItem(`checksplit_name_${code}`);
}

function setStoredName(code: string, name: string): void {
  localStorage.setItem(`checksplit_name_${code}`, name);
}

function isSubItemClaimedByMe(item: Item, subIndex: number, myName: string): boolean {
  const claimants = item.claims[String(subIndex)] || [];
  return claimants.includes(myName);
}

function getSubItemClaimants(item: Item, subIndex: number): string[] {
  return item.claims[String(subIndex)] || [];
}

function countMyClaimedSubItems(item: Item, myName: string): number {
  let count = 0;
  for (let i = 0; i < item.quantity; i++) {
    if (isSubItemClaimedByMe(item, i, myName)) {
      count++;
    }
  }
  return count;
}

function isItemFullyClaimed(item: Item): boolean {
  for (let i = 0; i < item.quantity; i++) {
    if (getSubItemClaimants(item, i).length === 0) {
      return false;
    }
  }
  return true;
}

export function ViewCheck() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const [check, setCheck] = useState<Check | null>(null);
  const [summary, setSummary] = useState<CheckSummary | null>(null);
  const [participantName, setParticipantName] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [showSummary, setShowSummary] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!code) return;

    const storedName = getStoredName(code);
    if (storedName) {
      setParticipantName(storedName);
    }

    loadCheck();
  }, [code]);

  useEffect(() => {
    if (check) {
      document.title = check.title ? `${check.title} - Checksplit` : `Check ${code} - Checksplit`;
    }
    return () => {
      document.title = "Checksplit";
    };
  }, [check, code]);

  const loadCheck = async () => {
    if (!code) return;
    try {
      const [checkData, summaryData] = await Promise.all([
        getCheck(code),
        getCheckSummary(code),
      ]);
      setCheck(checkData);
      setSummary(summaryData);
    } catch {
      setError("Failed to load check");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetName = () => {
    if (!nameInput.trim() || !code) return;
    const name = nameInput.trim();
    setStoredName(code, name);
    setParticipantName(name);
  };

  const handleToggleSubItemClaim = async (itemId: string, subIndex: number) => {
    if (!code || !participantName || isClaiming) return;

    setIsClaiming(true);
    try {
      const updatedCheck = await claimSubItem(code, {
        participant_name: participantName,
        item_id: itemId,
        sub_item_index: subIndex,
      });
      setCheck(updatedCheck);

      const summaryData = await getCheckSummary(code);
      setSummary(summaryData);
    } catch {
      setError("Failed to update claim");
    } finally {
      setIsClaiming(false);
    }
  };

  const handleToggleExpand = (itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleRefresh = () => {
    setIsLoading(true);
    loadCheck();
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/check/${code}`;
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied to clipboard");
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
        <Button onClick={() => navigate("/")}>
          <Home className="h-4 w-4 mr-2" />
          Go Home
        </Button>
      </div>
    );
  }

  const symbol = CURRENCY_SYMBOLS[check.currency];
  const myParticipant = summary?.participants.find((p) => p.name === participantName);

  // Show full-page name entry if no name is set
  if (!participantName) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-xs">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <User className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">
              {check.title ? `Join ${check.title}` : `Join Check ${code}`}
            </h1>
            {check.description && (
              <p className="text-muted-foreground mb-2">{check.description}</p>
            )}
            <p className="text-muted-foreground">Enter your name to start claiming items</p>
          </div>

          <div className="space-y-4">
            <Input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="Your name"
              onKeyDown={(e) => e.key === "Enter" && handleSetName()}
              className="text-center text-lg h-12"
              autoFocus
            />
            <Button onClick={handleSetName} className="w-full h-12" disabled={!nameInput.trim()}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 pb-48">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">{check.title || `Check ${code}`}</h1>
            {check.title && (
              <p className="text-sm text-muted-foreground">#{code}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4 mr-1" />
              Copy Link
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </div>

        {check.description ? (
          <p className="text-sm text-muted-foreground mb-6">{check.description}</p>
        ) : (
          <div className="mb-2" />
        )}

        <div className="flex gap-2 mb-6">
          <Button
            variant={!showSummary ? "default" : "outline"}
            size="sm"
            onClick={() => setShowSummary(false)}
            className="flex-1"
          >
            <ShoppingCart className="h-4 w-4 mr-1" />
            Claim Items
          </Button>
          <Button
            variant={showSummary ? "default" : "outline"}
            size="sm"
            onClick={() => setShowSummary(true)}
            className="flex-1"
          >
            <PieChart className="h-4 w-4 mr-1" />
            Summary
          </Button>
        </div>

        {!showSummary ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground mb-4">
              Tap items you ordered to claim them
            </p>
            {check.items.map((item) => {
              const isExpanded = expandedItems.has(item.id);
              const myClaimedCount = participantName ? countMyClaimedSubItems(item, participantName) : 0;
              const fullyClaimed = isItemFullyClaimed(item);

              if (item.quantity === 1) {
                const claimants = getSubItemClaimants(item, 0);
                const isMine = participantName ? claimants.includes(participantName) : false;
                const claimCount = claimants.length;

                return (
                  <Card
                    key={item.id}
                    className={`cursor-pointer transition-all ${
                      isMine ? "border-primary bg-primary/5" : ""
                    } ${fullyClaimed && !isMine ? "opacity-60" : ""}`}
                    onClick={() => handleToggleSubItemClaim(item.id, 0)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className={`font-medium ${isMine ? "text-primary" : ""}`}>
                            {item.name}
                          </p>
                          {claimCount > 0 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {claimants.join(", ")}
                              {claimCount > 1 && ` (split ${claimCount} ways)`}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className={`font-medium ${isMine ? "text-primary" : ""}`}>
                            {symbol}{item.unit_price}
                          </p>
                          {claimCount > 1 && (
                            <p className="text-xs text-muted-foreground">
                              {symbol}{(parseFloat(item.unit_price) / claimCount).toFixed(2)} each
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <Collapsible
                  key={item.id}
                  open={isExpanded}
                  onOpenChange={() => handleToggleExpand(item.id)}
                >
                  <Card className={`transition-all ${myClaimedCount > 0 ? "border-primary" : ""} ${fullyClaimed && myClaimedCount === 0 ? "opacity-60" : ""}`}>
                    <CollapsibleTrigger asChild>
                      <CardContent className="p-4 cursor-pointer">
                        <div className="flex justify-between items-start">
                          <div className="flex items-start gap-2">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                            )}
                            <div>
                              <p className={`font-medium ${myClaimedCount > 0 ? "text-primary" : ""}`}>
                                {item.name}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {item.quantity}× @ {symbol}{item.unit_price} each
                                {myClaimedCount > 0 && (
                                  <span className="text-primary ml-2">
                                    ({myClaimedCount} claimed by you)
                                  </span>
                                )}
                              </p>
                            </div>
                          </div>
                          <p className={`font-medium ${myClaimedCount > 0 ? "text-primary" : ""}`}>
                            {symbol}{item.total_price}
                          </p>
                        </div>
                      </CardContent>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-4 pb-4 space-y-2">
                        {Array.from({ length: item.quantity }, (_, subIndex) => {
                          const claimants = getSubItemClaimants(item, subIndex);
                          const isMine = participantName ? claimants.includes(participantName) : false;
                          const claimCount = claimants.length;
                          const subItemClaimed = claimCount > 0;

                          return (
                            <div
                              key={subIndex}
                              className={`p-3 rounded-md border cursor-pointer transition-all ${
                                isMine
                                  ? "border-primary bg-primary/5"
                                  : subItemClaimed
                                  ? "border-muted bg-muted/30 opacity-70"
                                  : "border-border hover:border-muted-foreground"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleSubItemClaim(item.id, subIndex);
                              }}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <p className={`text-sm ${isMine ? "text-primary font-medium" : ""}`}>
                                    {item.name} #{subIndex + 1}
                                  </p>
                                  {claimCount > 0 && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {claimants.join(", ")}
                                      {claimCount > 1 && ` (split ${claimCount} ways)`}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className={`text-sm ${isMine ? "text-primary font-medium" : ""}`}>
                                    {symbol}{item.unit_price}
                                  </p>
                                  {claimCount > 1 && (
                                    <p className="text-xs text-muted-foreground">
                                      {symbol}{(parseFloat(item.unit_price) / claimCount).toFixed(2)} each
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {summary && summary.participants.length > 0 ? (
              summary.participants.map((p) => (
                <Card key={p.name} className={p.name === participantName ? "border-primary" : ""}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium">
                          {p.name}
                          {p.name === participantName && " (You)"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Items: {symbol}{p.items_subtotal}
                          {parseFloat(p.tip_share) > 0 && ` + Tip: ${symbol}${p.tip_share}`}
                        </p>
                      </div>
                      <p className="text-xl font-bold">
                        {symbol}{p.total}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <p className="text-center text-muted-foreground">No one has claimed items yet</p>
            )}

            {summary && parseFloat(summary.unclaimed_total) > 0 && (
              <Card className="border-dashed">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center text-muted-foreground">
                    <p>Unclaimed items</p>
                    <p className="font-medium">
                      {symbol}{summary.unclaimed_total}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {participantName && myParticipant && (
        <Card className="fixed bottom-0 left-0 right-0 rounded-none border-x-0 border-b-0">
          <CardContent className="p-4 max-w-md mx-auto">
            <div className="flex justify-between items-center gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Your total:</p>
                <p className="text-xs text-muted-foreground">
                  {parseFloat(check.tip_amount) > 0 && "Including tip share"}
                </p>
              </div>
              <p className="text-3xl font-bold">
                {symbol}{myParticipant.total}
              </p>
            </div>
            <div className="flex justify-between items-center pt-2 mt-2 border-t text-muted-foreground text-sm">
              <p>Bill total{parseFloat(check.tip_amount) > 0 && " (incl. tip)"}</p>
              <p className="font-medium">
                {symbol}{(check.items.reduce((sum, item) => sum + parseFloat(item.total_price), 0) + parseFloat(check.tip_amount)).toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
