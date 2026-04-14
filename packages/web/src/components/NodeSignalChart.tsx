import { useTranslation } from "react-i18next";
import {
  getSnrTone,
  getRssiTone,
  SNR_GOOD_THRESHOLD,
  SNR_FAIR_THRESHOLD,
  RSSI_GOOD_THRESHOLD,
  RSSI_FAIR_THRESHOLD,
} from "@components/PageComponents/DarkMesh/GatewayHeader.tsx";

interface NodeSignalChartProps {
  snr?: number | null;
  rssi?: number | null;
  noBackground?: boolean;
  invertOrder?: boolean;
}

export default function NodeSignalChart({
  snr,
  rssi,
  noBackground = false,
  invertOrder = false,
}: NodeSignalChartProps) {
  const { t } = useTranslation();

  const snrVal = typeof snr === "number" ? snr : 0;
  const rssiVal = typeof rssi === "number" ? rssi : -140;

  // Derive a sensible min/max span around Gateway thresholds for consistent scaling
  const snrSpan = Math.abs(SNR_GOOD_THRESHOLD - SNR_FAIR_THRESHOLD) || 8;
  const snrMin = SNR_FAIR_THRESHOLD - snrSpan;
  const snrMax = SNR_GOOD_THRESHOLD + snrSpan;
  const snrWidth = Math.round(
    Math.min(Math.max((snrVal - snrMin) / (snrMax - snrMin), 0), 1) * 100,
  );

  const rssiSpan = Math.abs(RSSI_GOOD_THRESHOLD - RSSI_FAIR_THRESHOLD) || 11;
  const rssiMin = RSSI_FAIR_THRESHOLD - rssiSpan;
  const rssiMax = RSSI_GOOD_THRESHOLD + rssiSpan;
  const rssiWidth = Math.round(
    Math.min(Math.max((rssiVal - rssiMin) / (rssiMax - rssiMin), 0), 1) * 100,
  );

  const snrTone = getSnrTone(typeof snr === "number" ? snr : undefined);
  const rssiTone = getRssiTone(typeof rssi === "number" ? rssi : undefined);

  const firstBlock = (
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
          style={{ width: `${rssiWidth}%`, background: rssiTone.background }}
        />
      </div>
    </div>
  );

  const secondBlock = (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className={noBackground ? "text-sx" : "text-sm"}>{t("nodeDetails.snr", "SNR")}</span>
        <span className={noBackground ? "text-sx font-medium" : "text-sm font-medium"}>
          {snrVal} dB
        </span>
      </div>
      <div
        className={`w-full ${noBackground ? "h-2" : "h-4"} bg-slate-200 rounded overflow-hidden`}
      >
        <div
          className={`${noBackground ? "h-2" : "h-4"} rounded`}
          style={{ width: `${snrWidth}%`, background: snrTone.background }}
        />
      </div>
    </div>
  );

  return (
    <div
      className={`rounded-lg ${noBackground ? "mt-3" : "mt-0 bg-slate-100 px-3 text-slate-900 dark:bg-slate-800 dark:text-slate-100"}`}
    >
      {!noBackground && <p className="text-lg font-semibold">{t("nodeDetails.signalChart", "")}</p>}
      <div className="mt-2 grid grid-cols-1 gap-1">
        {invertOrder ? secondBlock : firstBlock}
        {invertOrder ? firstBlock : secondBlock}
      </div>
    </div>
  );
}
