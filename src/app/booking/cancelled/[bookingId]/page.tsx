import { Suspense } from "react";
import { ReleaseNotice } from "@/components/booking/ReleaseNotice";

export default function BookingCancelledPage() {
  return (
    <Suspense fallback={null}>
      <ReleaseNotice
        title="Booking cancelled"
        message="You cancelled the payment, so nothing was charged and the time slot has been released. You're welcome to start again whenever you're ready."
      />
    </Suspense>
  );
}
