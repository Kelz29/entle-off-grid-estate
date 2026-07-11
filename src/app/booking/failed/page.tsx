import { ReleaseNotice } from "@/components/booking/ReleaseNotice";

export default function BookingFailedPage() {
  return (
    <ReleaseNotice
      title="Payment didn't go through"
      message="Your payment could not be completed, so nothing was charged and the time slot has been released. Please try again — a different card usually does the trick."
    />
  );
}
