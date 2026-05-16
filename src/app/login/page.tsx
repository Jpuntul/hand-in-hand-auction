import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/queries";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="container mx-auto max-w-md py-12 px-4">
      <LoginForm />
    </div>
  );
}
