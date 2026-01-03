import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, ChevronRight, ScanLine, Users, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface Step {
  title: string;
  description: string;
  tips?: string[];
}

interface Flow {
  title: string;
  icon: React.ElementType;
  description: string;
  steps: Step[];
}

const flows: Flow[] = [
  {
    title: "Creating a Checksplit",
    icon: ScanLine,
    description: "You're the one with the receipt",
    steps: [
      {
        title: "1. Scan your receipt",
        description: "Take a photo of your receipt or upload an image. The app uses AI to extract all the items automatically.",
        tips: [
          "Use clear, well-lit photos for best results",
          "You can upload multiple images if your receipt is long",
          "Don't worry about translating items - the AI handles it",
          "Avoid uploading the same section twice or items will be duplicated",
        ],
      },
      {
        title: "2. Check and correct items",
        description: "Review the extracted items and make any necessary corrections before creating your checksplit.",
        tips: [
          "Verify prices match your receipt",
          "Adjust quantities if the scan got them wrong",
          "Remove any incorrectly added items (like tax lines)",
          "Add any items that were missed",
          "You can switch between unit price and total price input",
        ],
      },
      {
        title: "3. Add payment methods",
        description: "Set up how you want to receive payments. You can add your bank account, PayPal, or other payment instructions.",
        tips: [
          "Bank transfers generate a QR code that others can scan with their banking app",
          "PayPal links automatically include the amount owed",
          "You can add multiple payment methods",
          "At least one payment method is required",
        ],
      },
      {
        title: "4. Create and share",
        description: "Once everything looks good, create your checksplit. You'll get a 6-character code to share with your friends.",
        tips: [
          "Add a title to help everyone identify the check",
          "Add a tip amount if you want to split it fairly",
          "Share via the Copy Link button, or just share the code",
        ],
      },
      {
        title: "5. Claim your own items",
        description: "Don't forget to claim the items you ordered! Join your own checksplit and tap on what you had.",
        tips: [
          "Your name is saved for this checksplit, so you won't need to enter it again",
          "You can unclaim items if you made a mistake",
        ],
      },
    ],
  },
  {
    title: "Joining a Checksplit",
    icon: Users,
    description: "Someone shared a code with you",
    steps: [
      {
        title: "1. Join the checksplit",
        description: "You can join by clicking a shared link, or by going to the homepage and entering the 6-character code.",
        tips: [
          "The code is not case-sensitive",
          "Ask the creator if you don't have the code",
        ],
      },
      {
        title: "2. Claim your items",
        description: "Enter your name and tap on the items you ordered. If you shared something, each portion can be claimed separately.",
        tips: [
          "Tap an item to expand it and see individual portions",
          "Each portion of an item can be claimed by a different person",
          "Check the summary tab to see what everyone owes",
          "Your share of the tip is calculated automatically based on what you claimed",
        ],
      },
      {
        title: "3. Pay your share",
        description: "Once you've claimed your items, tap the Pay Now button to see payment options and your total amount owed.",
        tips: [
          "Scan the QR code with your banking app to pay instantly",
          "PayPal links pre-fill the amount on desktop, but on mobile you may need to enter it manually",
          "Make sure everyone has claimed their items before paying - unclaimed items affect tip calculations",
          "You can download the QR code to pay later",
        ],
      },
    ],
  },
];

export function HowItWorks() {
  const navigate = useNavigate();
  const [openFlows, setOpenFlows] = useState<string[]>([]);

  const toggleFlow = (title: string) => {
    setOpenFlows((prev) =>
      prev.includes(title)
        ? prev.filter((t) => t !== title)
        : [...prev, title]
    );
  };

  return (
    <div className="min-h-screen p-4 pb-24">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-2">How Checksplit Works</h1>
        <p className="text-muted-foreground mb-6">
          Split restaurant bills fairly with friends
        </p>

        <div className="space-y-4">
          {flows.map((flow) => (
            <Collapsible
              key={flow.title}
              open={openFlows.includes(flow.title)}
              onOpenChange={() => toggleFlow(flow.title)}
            >
              <Card>
                <CollapsibleTrigger asChild>
                  <CardContent className="p-4 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <flow.icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{flow.title}</p>
                        <p className="text-sm text-muted-foreground">{flow.description}</p>
                      </div>
                      {openFlows.includes(flow.title) ? (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </CardContent>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-4">
                    {flow.steps.map((step) => (
                      <div key={step.title} className="border-t pt-4">
                        <p className="font-medium mb-1">{step.title}</p>
                        <p className="text-sm text-muted-foreground mb-3">
                          {step.description}
                        </p>
                        {step.tips && step.tips.length > 0 && (
                          <div className="bg-muted/50 rounded-lg p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <Lightbulb className="h-4 w-4 text-amber-500" />
                              <p className="text-sm font-medium">Tips</p>
                            </div>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              {step.tips.map((tip, i) => (
                                <li key={i} className="flex gap-2">
                                  <span className="text-muted-foreground/50">•</span>
                                  <span>{tip}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>

        <div className="mt-8">
          <Button variant="ghost" className="w-full" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </div>
    </div>
  );
}
