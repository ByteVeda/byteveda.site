// Deep, not through `@/components`: that barrel re-exports the console's client
// components, and this file is on the settings front door — every server module
// that imports `@/features/settings` would pull the whole UI graph with it.
import { PageHeader } from "@/components/page-header";
import { can, requirePermission } from "@/features/auth";
import { emailConfigured } from "@/lib/email/client";
import { getSettings } from "../queries";
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
