import { Suspense } from "react";
import LoginForm from "./LoginForm";

export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-eoe-ivory text-sm text-eoe-ink">
          Loading…
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
