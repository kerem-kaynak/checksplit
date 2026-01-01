import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogIn, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCheck } from "@/services/api";

export function JoinCheck() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    setIsLoading(true);
    setError(null);
    try {
      await getCheck(code);
      navigate(`/check/${code.toUpperCase()}`);
    } catch (err) {
      setError("Check not found. Please verify the code.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-8">Join a Checksplit</h1>

      <form onSubmit={handleSubmit} className="w-full max-w-xs">
        <div className="mb-4">
          <Label htmlFor="code" className="mb-2 block">
            Enter Code
          </Label>
          <Input
            id="code"
            type="text"
            placeholder="ABC123"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            className="text-center text-2xl font-mono tracking-widest"
            autoComplete="off"
          />
        </div>

        {error && <p className="text-destructive mb-4 text-sm">{error}</p>}

        <Button type="submit" className="w-full mb-3" disabled={isLoading || !code.trim()}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4 mr-2" />
              Join
            </>
          )}
        </Button>
        <Button variant="ghost" onClick={() => navigate("/")} className="w-full">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </form>
    </div>
  );
}
