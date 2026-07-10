"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markRead } from "./actions";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Bell, CheckCircle2, Undo2, Inbox, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Components (including icon functions) can't cross the Server->Client
// boundary as props — resolve from a plain string type instead.
const TYPE_ICON: Record<string, LucideIcon> = {
  stage_ready: Clock,
  published: CheckCircle2,
  returned: Undo2,
  approval: Inbox,
};

export function NotificationRow({
  id,
  body,
  createdAt,
  read,
  link,
  type,
}: {
  id: string;
  body: string;
  createdAt: string;
  read: boolean;
  link: string | null;
  type: string;
}) {
  const Icon = TYPE_ICON[type] ?? Bell;
  const router = useRouter();
  const [, startTransition] = useTransition();

  const handleClick = () => {
    if (!link) return;
    if (!read) startTransition(() => markRead(id));
    router.push(link);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!link}
      className={cn(
        "flex w-full items-start gap-3 px-5 py-3.5 border-b border-border last:border-0 text-left transition-colors",
        !read && "bg-brand-soft/30",
        link && "hover:bg-muted/40 cursor-pointer"
      )}
    >
      <div
        className={cn(
          "size-8 rounded-lg grid place-items-center shrink-0 mt-0.5",
          read ? "bg-muted text-muted-foreground" : "bg-brand/10 text-brand"
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm", !read && "font-medium")}>{body}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{relativeTime(createdAt)}</p>
      </div>
      {!read && <span className="size-2 rounded-full bg-brand shrink-0 mt-2" />}
    </button>
  );
}
