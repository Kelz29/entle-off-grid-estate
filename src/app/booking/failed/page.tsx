import { redirect } from "next/navigation";

/** Legacy `?booking=&token=` → path-based failure URL. */
export default async function LegacyFailedPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string; token?: string }>;
}) {
  const { booking, token } = await searchParams;
  if (booking) {
    const qs = token ? `?token=${encodeURIComponent(token)}` : "";
    redirect(`/booking/failed/${encodeURIComponent(booking)}${qs}`);
  }
  redirect("/");
}
