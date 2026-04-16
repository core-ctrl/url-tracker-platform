import { Metadata } from 'next'
import { database } from "@/lib/firebase";
import { ref, get } from "firebase/database";
import { ShareLink } from "@/components/interfaces/sharelink.interface";
import TrackClient from './TrackClient';
import { Suspense } from 'react';
export async function generateMetadata(
  { searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }
): Promise<Metadata> {
  const id = searchParams.id as string;

  // Fetch share link data
  const shareLinkRef = ref(database, `shareLinks/${id}`);
  const snapshot = await get(shareLinkRef);
  const shareLink = snapshot.exists() ? snapshot.val() as ShareLink : null;

  const ogImage = shareLink?.imageUrl?.trim();
  const ogImages = ogImage
    ? [{ url: ogImage }]
    : [{ url: "/assets/images/instagram.png" }];

  return {
    title: shareLink?.title || "Live Location",
    description: shareLink?.description || "Share your live location.",
    openGraph: {
      title: shareLink?.title || "Live Location",
      description: shareLink?.description || "Share your live location.",
      images: ogImages,
    },
    twitter: {
      card: "summary_large_image",
      title: shareLink?.title || "Live Location",
      description: shareLink?.description || "Share your live location.",
      images: ogImage ? [ogImage] : ["/assets/images/instagram.png"],
    },
  };
}

export default function TrackPage() {
  return(
    <Suspense fallback={<div>Loading...</div>}>
      <TrackClient />
    </Suspense>
  )
}
