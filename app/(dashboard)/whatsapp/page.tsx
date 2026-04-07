import type { Metadata } from "next";
import { WhatsAppSendForm } from "./WhatsAppSendForm";
import { MessageCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "WhatsApp | GoTrackerr",
  description: "Send a test message via WhatsApp Cloud API",
};

export default function WhatsAppPage() {
  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-border/60">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-50 dark:bg-green-950 shrink-0">
          <MessageCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">WhatsApp</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Send messages via Meta Cloud API
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl space-y-5">
          <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Messages are sent using server-side credentials. The HTTP endpoint{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-foreground">POST /api/whatsapp</code> is
              available for integrations — set{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-foreground">WHATSAPP_API_SECRET</code> and
              pass header{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-foreground">x-internal-key</code> to restrict access.
            </p>
          </div>
          <WhatsAppSendForm />
        </div>
      </div>
    </div>
  );
}
