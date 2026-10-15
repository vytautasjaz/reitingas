import { SettingsForm } from "@/components/SettingsForm";
import { getDb } from "@/lib/db";
import { formulaDescription, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  getDb();
  const settings = getSettings();
  const formula = formulaDescription(settings);

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h1>Nustatymai</h1>
        <p>Taisyklės ir bazės — išsaugojus rezultatai perskaičiuojami.</p>
      </div>
      <SettingsForm initial={settings} initialFormula={formula} />
    </div>
  );
}
