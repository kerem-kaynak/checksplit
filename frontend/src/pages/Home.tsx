import { useNavigate } from "react-router-dom";
import { Receipt, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Home() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-8">checksplit</h1>
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
      </div>
    </div>
  );
}
