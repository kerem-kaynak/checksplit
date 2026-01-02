import { useNavigate } from "react-router-dom";
import { Receipt, Users, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="flex items-center gap-3 mb-8">
        <img src="/favicon.svg" alt="Checksplit logo" className="h-10 w-10" />
        <h1 className="text-3xl font-bold">Checksplit</h1>
      </div>
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <Button
          size="lg"
          className="w-full"
          onClick={() => navigate("/create")}
        >
          <Receipt className="h-5 w-5 mr-2" />
          Create New
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full"
          onClick={() => navigate("/join")}
        >
          <Users className="h-5 w-5 mr-2" />
          Join with Code
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => navigate("/how-it-works")}
        >
          <HelpCircle className="h-4 w-4 mr-2" />
          Learn how it works
        </Button>
      </div>
    </div>
  );
}
