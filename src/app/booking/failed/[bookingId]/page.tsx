import { Suspense } from "react";
import { ReleaseNotice } from "@/components/booking/ReleaseNotice";

export default function BookingFailedPage() {
  return (
    <Suspense fallback={null}>
      <ReleaseNotice
        title="Payment didn't go through"
        message="Your payment could not be completed, so nothing was charged and the time slot has been released. Please try again. A different card usually does the trick."
      />
    </Suspense>
  );
}
