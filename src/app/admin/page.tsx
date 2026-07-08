import { redirect } from "next/navigation";

// The admin layout handles auth. This root page just redirects to the default tab.
export default function AdminRootPage() {
  redirect("/admin/bookings");
}
