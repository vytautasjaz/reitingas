import { SettingsForm } from "@/components/SettingsForm";
import { getDb } from "@/lib/db";
import { formulaDescription, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  getDb();
  const settings = getSettings();
  const formula = formulaDescription(settings);

  return (
    <div className="space-y-3">
      <div className="page-header page-header-tight">
        <div>
          <h1>Nustatymai</h1>
          <p>Taisyklės ir bazės — išsaugojus rezultatai perskaičiuojami.</p>
        </div>
      </div>
      <SettingsForm initial={settings} initialFormula={formula} />
    </div>
  );
}
