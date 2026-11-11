// Auth gate layout for the owner area (client-only; session in localStorage).
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// Auth gate for the owner area. Runs on the client only (ssr: false) because
// the session lives in localStorage, which the server cannot read. A
// server-side check would loop signed-in users back to /auth on every hard
// refresh. requireSupabaseAuth re-validates every protected fetch downstream.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
