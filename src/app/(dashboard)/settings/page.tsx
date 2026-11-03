import type { Metadata } from "next";
import { SettingsPanel } from "@/components/settings/settings-panel";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Settings" description="Your trip preferences and how this demo works." />
      <SettingsPanel />
    </div>
  );
}
