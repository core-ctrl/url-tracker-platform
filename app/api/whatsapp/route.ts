import { NextResponse } from "next/server";
import { sendWhatsAppTextMessage } from "@/lib/whatsapp-cloud";

export const dynamic = "force-dynamic";

type RequestBody = {
  message?: unknown;
};

export async function POST(request: Request) {
  const configuredSecret = process.env.WHATSAPP_API_SECRET;
  if (configuredSecret) {
    const key = request.headers.get("x-internal-key");
    if (key !== configuredSecret) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const message =
    typeof body.message === "string" ? body.message : "";

  const result = await sendWhatsAppTextMessage(message);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error },
      { status: result.statusCode }
    );
  }

  return NextResponse.json({
    success: true,
    messageId: result.messageId,
  });
}
