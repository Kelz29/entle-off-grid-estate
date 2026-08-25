import { redirect } from "next/navigation";

/** Legacy `?booking=&token=` → path-based cancel URL. */
export default async function LegacyCancelledPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string; token?: string }>;
}) {
  const { booking, token } = await searchParams;
  if (booking) {
    const qs = token ? `?token=${encodeURIComponent(token)}` : "";
    redirect(`/booking/cancelled/${encodeURIComponent(booking)}${qs}`);
  }
  redirect("/");
}
