import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-4">
      <h2 className="text-3xl font-semibold tracking-tight mb-2">Page not found</h2>
      <p className="text-muted-foreground text-center mb-8 max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or the link may be invalid.
      </p>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}