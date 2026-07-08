// Resolve a lucide icon by name so nav config can stay as plain strings.
import {
  Home, FilePlus2, FileText, FolderClosed, MessagesSquare, Bell, CircleHelp,
  LayoutDashboard, KanbanSquare, Building2, Factory, Sparkles, Inbox,
  CalendarClock, TriangleAlert, Scale, MessageSquareWarning, Users,
  LayoutTemplate, ScrollText, History, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Home, FilePlus2, FileText, FolderClosed, MessagesSquare, Bell, CircleHelp,
  LayoutDashboard, KanbanSquare, Building2, Factory, Sparkles, Inbox,
  CalendarClock, TriangleAlert, Scale, MessageSquareWarning, Users,
  LayoutTemplate, ScrollText, History,
};

export function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = ICONS[name] ?? Home;
  return <Cmp className={className} />;
}
