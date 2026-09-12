import { PageHeader } from "@/components";
import { emailConfigured } from "@/lib/email/client";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export async function SettingsPage() {
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
