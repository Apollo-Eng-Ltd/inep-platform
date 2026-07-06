"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap } from "lucide-react";
import { Icon } from "@/components/icon";
import { cn } from "@/lib/utils";
import type { NavGroup } from "@/lib/nav";

export function AppSidebar({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col h-screen">
      <div className="h-16 flex items-center gap-2.5 px-6">
        <div className="size-8 rounded-xl bg-brand grid place-items-center text-white shadow-sm">
          <Zap className="size-4.5" />
        </div>
        <span className="font-medium tracking-tight">INEP</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3.5 pb-4 space-y-5">
        {groups.map((group, i) => (
          <div key={i} className="space-y-1">
            {group.heading && (
              <p className="px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {group.heading}
              </p>
            )}
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-all duration-150",
                    active
                      ? "bg-card text-sidebar-accent-foreground font-medium shadow-sm ring-1 ring-foreground/[0.06]"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <Icon name={item.icon} className="size-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
