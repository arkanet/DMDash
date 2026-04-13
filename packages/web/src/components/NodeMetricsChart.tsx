import { useTranslation } from "react-i18next";

interface NodeMetricsChartProps {
  airUtilTx?: number | null;
  channelUtilization?: number | null;
  noBackground?: boolean;
}
export default function NodeMetricsChart({
  airUtilTx,
  channelUtilization,
  noBackground = false,
}: NodeMetricsChartProps) {
  const { t } = useTranslation();
  const airVal = typeof airUtilTx === "number" ? airUtilTx : 0;
  const chVal = typeof channelUtilization === "number" ? channelUtilization : 0;

  // Channel color: hue from 120 (green) -> 0 (red) over 0-100
  // Use 4-step gradient: green(120) -> yellow(60) -> orange(30) -> red(0)
  function hueFromSegments(val: number, max: number) {
    const t = Math.min(Math.max(val / max, 0), 1);
    if (t <= 1 / 3) {
      // green -> yellow
      const local = t / (1 / 3);
      return 120 - (120 - 60) * local;
    } else if (t <= 2 / 3) {
      // yellow -> orange
      const local = (t - 1 / 3) / (1 / 3);
      return 60 - (60 - 30) * local;
    }
    // orange -> red
    const local = (t - 2 / 3) / (1 / 3);
    return 30 - 30 * local;
  }

  const channelHue = hueFromSegments(chVal, 100);
  const channelColor = `hsl(${channelHue} 85% 45%)`;

  // Air scale: logarithmic mapping for values up to the limit (10%).
  const airLimit = 10;

  // If airVal > airLimit we show Over Limit; otherwise map 0..airLimit -> 0..100 via log
  function logNormalizedAir(val: number) {
    const v = Math.max(val, 0.0001);
    // Map [0.0001 .. airLimit] -> [0..1] using log10
    const numerator = Math.log10(v + 1) - Math.log10(1);
    const denom = Math.log10(airLimit + 1) - Math.log10(1);
    return Math.min(Math.max(numerator / (denom || 1), 0), 1);
  }

  const airPctOfLimit = Math.min(Math.max(airVal, 0) / airLimit, 1);
  const airHue = hueFromSegments(airPctOfLimit * airLimit, airLimit);
  const airColor = `hsl(${airHue} 85% 45%)`;

  const airBarWidth = Math.min(Math.max(logNormalizedAir(airVal) * 100, 0), 100);
  const chBarWidth = Math.min(Math.max(chVal, 0), 100);

  return (
    <div
      className={`mt-3 rounded-lg ${!noBackground ? "bg-slate-100 p-3 text-slate-900 dark:bg-slate-800 dark:text-slate-100" : ""}`}
    >
      <p className="text-lg font-semibold">{t("nodeDetails.utilizationChart", "Utilization")}</p>
      <div className="mt-2 grid grid-cols-1 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm">{t("nodeDetails.airTxUtilization", "Airtime Util")}</span>
            <span className="text-sm font-medium">{airVal.toFixed(2)}%</span>
          </div>
          <div className="w-full h-4 bg-slate-200 rounded overflow-hidden relative">
            {airVal > airLimit ? (
              // Over limit: black bar with red bold text
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                <span className="text-red-500 font-bold">
                  {t("nodeDetails.overLimit", "Over Limit!")}
                </span>
              </div>
            ) : (
              <div
                className="h-4 rounded relative"
                style={{ width: `${airBarWidth}%`, background: airColor }}
              />
            )}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm">{t("nodeDetails.channelUtilization", "Channel Util")}</span>
            <span className="text-sm font-medium">{chVal.toFixed(2)}%</span>
          </div>
          <div className="w-full h-4 bg-slate-200 rounded overflow-hidden">
            <div
              className="h-4 rounded"
              style={{ width: `${chBarWidth}%`, background: channelColor }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
