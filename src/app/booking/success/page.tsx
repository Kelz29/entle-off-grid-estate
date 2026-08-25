import { redirect } from "next/navigation";

/** Legacy `?booking=` URLs → path-based success page. */
export default async function LegacyBookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ booking?: string }>;
}) {
  const { booking } = await searchParams;
  if (booking) {
    redirect(`/booking/success/${encodeURIComponent(booking)}`);
  }
  redirect("/");
}
