// Role-aware navigation. The sidebar renders whichever groups a role can see.
import type { Role } from "@/lib/auth";

export interface NavItem {
  label: string;
  href: string;
  icon: string; // lucide icon name, resolved in the sidebar
}
export interface NavGroup {
  heading?: string;
  items: NavItem[];
}

export function navForRole(role: Role): NavGroup[] {
  const home: NavItem = { label: "Home", href: "/", icon: "Home" };
  const help: NavItem = { label: "Help", href: "/help", icon: "CircleHelp" };
  const notifications: NavItem = { label: "Notifications", href: "/notifications", icon: "Bell" };

  if (role === "county_officer") {
    return [
      { items: [home] },
      {
        heading: "My county",
        items: [
          { label: "New submission", href: "/submissions/new", icon: "FilePlus2" },
          { label: "Submissions", href: "/submissions", icon: "FileText" },
          { label: "History", href: "/history", icon: "History" },
          { label: "Documents", href: "/documents", icon: "FolderClosed" },
          { label: "Public participation", href: "/participation", icon: "MessagesSquare" },
          { label: "Pipeline (Agents)", href: "/agent-pipeline", icon: "Waypoints" },
        ],
      },
      { heading: "Account", items: [notifications, help] },
    ];
  }

  // national_planner, committee_member, admin share the national view
  const national: NavGroup = {
    heading: "National",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
      { label: "Pipeline board", href: "/pipeline", icon: "KanbanSquare" },
      { label: "Pipeline (Agents)", href: "/agent-pipeline", icon: "Waypoints" },
      { label: "Provider plans", href: "/providers", icon: "Building2" },
      { label: "Private sector / PBO", href: "/private-sector", icon: "Factory" },
      { label: "Ask a question", href: "/query", icon: "Sparkles" },
    ],
  };
  const oversight: NavGroup = {
    heading: "Oversight",
    items: [
      { label: "Approval inbox", href: "/inbox", icon: "Inbox" },
      { label: "Deadlines", href: "/deadlines", icon: "CalendarClock" },
      { label: "Anomaly review", href: "/anomalies", icon: "TriangleAlert" },
      { label: "Cross-cutting", href: "/cross-cutting", icon: "Scale" },
      { label: "Comment moderation", href: "/moderation", icon: "MessageSquareWarning" },
    ],
  };
  const groups: NavGroup[] = [{ items: [home] }, national, oversight];

  if (role === "admin") {
    groups.push({
      heading: "Administration",
      items: [
        { label: "Users", href: "/admin/users", icon: "Users" },
        { label: "Templates", href: "/admin/templates", icon: "LayoutTemplate" },
        { label: "Audit log", href: "/admin/audit", icon: "ScrollText" },
      ],
    });
  }
  groups.push({ heading: "Account", items: [notifications, help] });
  return groups;
}
