import { database } from "@/lib/firebase";
import { ref, get } from "firebase/database";
import { notFound, redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ShortUrlRedirect({
  params,
}: {
  params: { code: string };
}) {
  const { code } = params;

  const shortUrlRef = ref(database, `shortUrls/${code}`);
  const snapshot = await get(shortUrlRef);

  if (snapshot.exists()) {
    const { linkId } = snapshot.val() as { linkId?: string };
    if (!linkId) {
      notFound();
    }
    redirect(`/track?id=${linkId}`);
  }

  notFound();
}