"use client";

import { useEffect, useState } from "react";

const envName = process.env.NEXT_PUBLIC_APP_NAME?.trim();

/**
 * Product label: NEXT_PUBLIC_APP_NAME, else current host, else a neutral default.
 */
export function SiteBrandName({ className }: { className?: string }) {
  const [label, setLabel] = useState(
    () => envName || "Location tracker"
  );

  useEffect(() => {
    if (!envName) {
      setLabel(window.location.hostname || "Location tracker");
    }
  }, []);

  return <span className={className}>{label}</span>;
}
