import { useTranslation } from "react-i18next";

interface NodeSignalChartProps {
  snr?: number | null;
  rssi?: number | null;
  noBackground?: boolean;
}

// local hueFromSegments copy to avoid circular import (small duplication)
function hueFromSegments(val: number, max: number) {
  const t = Math.min(Math.max(val / max, 0), 1);
  if (t <= 1 / 3) {
    const local = t / (1 / 3);
    return 120 - (120 - 60) * local;
  } else if (t <= 2 / 3) {
    const local = (t - 1 / 3) / (1 / 3);
    return 60 - (60 - 30) * local;
  }
  const local = (t - 2 / 3) / (1 / 3);
  return 30 - 30 * local;
}

export default function NodeSignalChart({ snr, rssi, noBackground = false }: NodeSignalChartProps) {
  const { t } = useTranslation();

  const snrVal = typeof snr === "number" ? snr : 0;
  const rssiVal = typeof rssi === "number" ? rssi : -140;

  // Map ranges
  const snrMin = -20;
  const snrMax = 20;
  const rssiMin = -140;
  const rssiMax = -80;

  const snrNorm = Math.min(Math.max((snrVal - snrMin) / (snrMax - snrMin), 0), 1);
  const rssiNorm = Math.min(Math.max((rssiVal - rssiMin) / (rssiMax - rssiMin), 0), 1);

  const snrHue = hueFromSegments(snrNorm * (snrMax - snrMin), snrMax - snrMin);
  const rssiHue = hueFromSegments(rssiNorm * (rssiMax - rssiMin), rssiMax - rssiMin);

  const snrColor = `hsl(${snrHue} 85% 45%)`;
  const rssiColor = `hsl(${rssiHue} 85% 45%)`;

  const snrWidth = Math.round(snrNorm * 100);
  const rssiWidth = Math.round(rssiNorm * 100);

  return (
    <div
      className={`rounded-lg ${noBackground ? "mt-3" : "mt-0 bg-slate-100 px-3 text-slate-900 dark:bg-slate-800 dark:text-slate-100"}`}
    >
      {!noBackground && <p className="text-lg font-semibold">{t("nodeDetails.signalChart", "")}</p>}
      <div className="mt-2 grid grid-cols-1 gap-1">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className={noBackground ? "text-sx" : "text-sm"}>
              {t("nodeDetails.rssi", "RSSI")}
            </span>
            <span className={noBackground ? "text-sx font-medium" : "text-sm font-medium"}>
              {rssiVal} dBm
            </span>
          </div>
          <div
            className={`w-full ${noBackground ? "h-2" : "h-4"} bg-slate-200 rounded overflow-hidden`}
          >
            <div
              className={`${noBackground ? "h-2" : "h-4"} rounded`}
              style={{ width: `${rssiWidth}%`, background: rssiColor }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className={noBackground ? "text-sx" : "text-sm"}>
              {t("nodeDetails.snr", "SNR")}
            </span>
            <span className={noBackground ? "text-sx font-medium" : "text-sm font-medium"}>
              {snrVal} dB
            </span>
          </div>
          <div
            className={`w-full ${noBackground ? "h-2" : "h-4"} bg-slate-200 rounded overflow-hidden`}
          >
            <div
              className={`${noBackground ? "h-2" : "h-4"} rounded`}
              style={{ width: `${snrWidth}%`, background: snrColor }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
