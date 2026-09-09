import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { SettingsForm } from "@/components/settings-form";
import { emailConfigured } from "@/lib/email/client";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <>
      <PageHeader title="Settings" />
      <div className="content content-form">
        <SettingsForm initial={settings} emailReady={emailConfigured()} />
      </div>
    </>
  );
}
