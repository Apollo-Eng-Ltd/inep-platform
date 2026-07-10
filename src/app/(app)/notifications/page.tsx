import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NotificationRow } from "./notification-row";
import { markAllRead } from "./actions";
import { Bell } from "lucide-react";

export default async function NotificationsPage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, type, body, link, read, created_at")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const hasUnread = (notifications ?? []).some((n) => !n.read);

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Alerts for plans that need your review, and updates on your own submissions."
      >
        {hasUnread && (
          <form action={markAllRead}>
            <Button type="submit" variant="outline" size="sm">
              Mark all read
            </Button>
          </form>
        )}
      </PageHeader>

      {!notifications?.length ? (
        <EmptyState
          icon={<Bell className="size-8" />}
          title="Nothing yet"
          description="You'll see stage-ready and status alerts here."
        />
      ) : (
        <Card className="p-0 overflow-hidden">
          <CardContent className="p-0">
            {notifications.map((n) => (
              <NotificationRow
                key={n.id}
                id={n.id}
                body={n.body}
                createdAt={n.created_at}
                read={n.read}
                link={n.link}
                type={n.type}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}
