// Deep, not through `@/components`: that barrel is all client components, so
// opening it inside a feature drags them into every server module that touches
// the feature.
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
