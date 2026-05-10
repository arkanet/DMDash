import { Badge } from "../UI/Badge.tsx";

export function SupportBadge({
  supported,
  labelSupported,
  labelUnsupported,
}: {
  supported: boolean;
  labelSupported: string;
  labelUnsupported: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Badge variant={supported ? "secondary" : "destructive"} className="whitespace-normal">
        {supported ? labelSupported : labelUnsupported}
      </Badge>
    </div>
  );
}
