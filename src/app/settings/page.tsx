import { SettingsForm } from "@/components/SettingsForm";
import { getDb } from "@/lib/db";
import { formulaDescription, getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  getDb();
  const settings = getSettings();
  const formula = formulaDescription(settings);

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1>Nustatymai</h1>
          <p>Reitingo taisyklės ir distancijų bazės. Išsaugojus taškai perskaičiuojami.</p>
        </div>
      </div>
      <SettingsForm initial={settings} initialFormula={formula} />
    </div>
  );
}
