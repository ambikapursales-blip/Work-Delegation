"use client";

import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import ConversationHub from "@/components/ConversationHub";

export default function DWRPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const taskParam = searchParams.get("task");
  const messageParam = searchParams.get("message");

  if (!user) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
          color: "var(--text-secondary)",
          fontSize: "14px",
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div className="-m-4 -mx-3 sm:-m-6 sm:-mx-4 lg:-mx-6 h-[calc(100vh-64px)]">
      <ConversationHub
        initialTaskId={taskParam}
        initialMessageId={messageParam}
      />
    </div>
  );
}
