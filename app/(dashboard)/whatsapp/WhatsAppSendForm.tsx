"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { sendWhatsAppFromDashboard } from "./actions";
import { Loader2, MessageCircle, Send } from "lucide-react";

export function WhatsAppSendForm() {
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    startTransition(async () => {
      const result = await sendWhatsAppFromDashboard(text);
      if (result.success) {
        setFeedback({
          type: "ok",
          text: `Sent. Message ID: ${result.messageId}`,
        });
        setText("");
      } else {
        setFeedback({ type: "err", text: result.error });
      }
    });
  };

  return (
    <Card className="w-full max-w-lg border-border shadow-sm">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-primary" aria-hidden />
          <CardTitle className="text-xl">Send WhatsApp</CardTitle>
        </div>
        <CardDescription>
          Sends a text message to the recipient configured in{" "}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">RECIPIENT_PHONE_NUMBER</code>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="wa-message">Message</Label>
            <textarea
              id="wa-message"
              name="message"
              required
              rows={5}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type the message to send..."
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isPending}
            />
          </div>
          {feedback && (
            <p
              role="status"
              className={
                feedback.type === "ok"
                  ? "text-sm text-green-700 dark:text-green-400"
                  : "text-sm text-destructive"
              }
            >
              {feedback.text}
            </p>
          )}
          <Button type="submit" disabled={isPending || !text.trim()} className="w-full sm:w-auto">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                Sending…
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" aria-hidden />
                Send message
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
