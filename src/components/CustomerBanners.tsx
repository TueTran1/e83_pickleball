"use client";

import { usePathname } from "next/navigation";
import AnnouncementBanner from "./AnnouncementBanner";

/** Renders announcement banners only on customer-facing pages (not /admin routes) */
export default function CustomerBanners() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return <AnnouncementBanner />;
}
