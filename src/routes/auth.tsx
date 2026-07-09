import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/auth-page";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — ISA Portal" }] }),
  component: AuthPage,
});
