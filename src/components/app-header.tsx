"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import type { Profile } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleBadge } from "@/components/badges";
import { initials } from "@/lib/format";

export function AppHeader({ profile, unread }: { profile: Profile; unread: number }) {
  const scope = profile.submitter?.name ?? "National level";

  return (
    <header className="h-16 shrink-0 border-b border-border/60">
      <div className="h-full px-5 sm:px-7 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{scope}</p>
          <p className="text-xs text-muted-foreground">Integrated National Energy Plan</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            render={<Link href="/notifications" aria-label="Notifications" />}
          >
            <Bell className="size-4.5" />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-danger ring-2 ring-background" />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full pl-1 pr-2.5 py-1 hover:bg-muted transition-colors">
              <Avatar className="size-8">
                <AvatarFallback className="bg-brand text-white text-xs">
                  {initials(profile.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="hidden sm:block text-left leading-tight">
                <p className="text-sm font-medium max-w-[10rem] truncate">{profile.full_name}</p>
                <p className="text-[11px] text-muted-foreground">{scope}</p>
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5 space-y-1.5">
                <p className="text-sm font-medium truncate">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                <RoleBadge role={profile.role} />
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href="/help">Help &amp; guidance</Link>} />
              <DropdownMenuSeparator />
              <form action={signOut}>
                <DropdownMenuItem
                  nativeButton
                  className="text-danger data-highlighted:text-danger"
                  render={
                    <button type="submit" className="w-full">
                      Sign out
                    </button>
                  }
                />
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
