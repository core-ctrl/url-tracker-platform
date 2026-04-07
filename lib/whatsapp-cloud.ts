const WHATSAPP_API_URL = "https://graph.facebook.com/v17.0";

type MetaSuccess = {
  messages?: Array<{ id: string }>;
};

type MetaErrorBody = {
  error?: { message?: string };
};

export async function sendWhatsAppTextMessage(
  message: string
): Promise<
  | { ok: true; messageId: string }
  | { ok: false; error: string; statusCode: number }
> {
  const trimmed = message.trim();
  if (!trimmed) {
    return { ok: false, error: "message is required", statusCode: 400 };
  }

  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const recipient = process.env.RECIPIENT_PHONE_NUMBER;

  if (!token || !phoneNumberId || !recipient) {
    return {
      ok: false,
      error: "WhatsApp integration is not configured",
      statusCode: 503,
    };
  }

  try {
    const res = await fetch(
      `${WHATSAPP_API_URL}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: recipient,
          type: "text",
          text: { body: trimmed },
        }),
      }
    );

    const data = (await res.json()) as MetaSuccess & MetaErrorBody;

    if (!res.ok) {
      const errMsg = data.error?.message ?? "WhatsApp API error";
      if (process.env.NODE_ENV === "development") {
        console.error("WhatsApp API error:", data);
      }
      return { ok: false, error: errMsg, statusCode: 502 };
    }

    const messageId = data.messages?.[0]?.id;
    if (!messageId) {
      return {
        ok: false,
        error: "Unexpected response from WhatsApp API",
        statusCode: 502,
      };
    }

    return { ok: true, messageId };
  } catch (e) {
    if (process.env.NODE_ENV === "development") {
      console.error("WhatsApp send failed:", e);
    }
    return {
      ok: false,
      error: "Failed to send message",
      statusCode: 500,
    };
  }
}
