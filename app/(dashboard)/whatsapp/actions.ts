"use server";

import { sendWhatsAppTextMessage } from "@/lib/whatsapp-cloud";

export async function sendWhatsAppFromDashboard(message: string) {
  const result = await sendWhatsAppTextMessage(message);
  if (!result.ok) {
    return { success: false as const, error: result.error };
  }
  return { success: true as const, messageId: result.messageId };
}
