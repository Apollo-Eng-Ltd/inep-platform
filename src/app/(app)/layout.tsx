import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { navForRole } from "@/lib/nav";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("read", false);

  const groups = navForRole(profile.role);

  return (
    // The sidebar sits transparently on the tinted background; the content is a
    // floating rounded panel. Separation comes from the gap + card, not a line.
    <div className="flex h-screen overflow-hidden">
      <AppSidebar groups={groups} />
      <div className="flex-1 min-w-0 flex flex-col px-2 py-2 md:pl-0">
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden rounded-2xl bg-card ring-1 ring-foreground/[0.06] shadow-card">
          <AppHeader profile={profile} unread={count ?? 0} />
          <div className="flex-1 overflow-y-auto">
            <main className="px-5 sm:px-7 lg:px-9 py-6 lg:py-8 max-w-[1400px] w-full mx-auto">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
