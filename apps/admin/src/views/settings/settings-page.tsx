import { PageHeader } from "@/components";
import { can } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/auth/session";
import { emailConfigured } from "@/lib/email/client";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./settings-form";

export async function SettingsPage() {
  const { access } = await requirePermission("settings.read");
  const settings = await getSettings();

  return (
    <>
      <PageHeader title="Settings" />
      <div className="content content-form">
        <SettingsForm
          initial={settings}
          emailReady={emailConfigured()}
          readOnly={!can(access, "settings.write")}
        />
      </div>
    </>
  );
}
