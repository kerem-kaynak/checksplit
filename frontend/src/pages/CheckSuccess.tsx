import { useParams, useNavigate } from "react-router-dom";
import { Share2, Copy, Link, Eye } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function CheckSuccess() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  const shareUrl = `${window.location.origin}/check/${code}`;

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(code || "");
    toast.success("Code copied to clipboard");
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    toast.success("Link copied to clipboard");
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "Join my Checksplit",
        text: `Join my check split with code: ${code}`,
        url: shareUrl,
      });
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold mb-2">Checksplit Created!</h1>
      <p className="text-muted-foreground mb-8">Share this code with your friends</p>

      <Card className="w-full max-w-xs mb-6">
        <CardContent className="p-6 text-center">
          <p className="text-4xl font-mono font-bold tracking-widest">{code}</p>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Button onClick={handleShare} className="w-full">
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
        <Button variant="outline" onClick={handleCopyCode} className="w-full">
          <Copy className="h-4 w-4 mr-2" />
          Copy Code
        </Button>
        <Button variant="outline" onClick={handleCopyLink} className="w-full">
          <Link className="h-4 w-4 mr-2" />
          Copy Link
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate(`/check/${code}`)}
          className="w-full"
        >
          <Eye className="h-4 w-4 mr-2" />
          View Check
        </Button>
      </div>
    </div>
  );
}
