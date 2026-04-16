export interface ScheduledMessage {
  nodeId: string; // e.g. "4^all^NOME" for broadcast or "123" for node num
  day: string; // "LUN","MAR",... matching Android PlanMsgActivity.DAYS
  time: string; // "HH:MM"
  msg: string; // message text
  toRemove?: number; // 0 add, 1 remove (Android uses toRemove when broadcasting)
}

export function keyFor(message: ScheduledMessage): string {
  return `${message.day} ${message.time}@${message.nodeId}`;
}

export function serializeLine(message: ScheduledMessage): string {
  // Android uses: "DAY HH:MM — msg" where separator is a long dash
  const SEP = " — ";
  return `${message.day} ${message.time}${SEP}${message.msg}`;
}

export function parseLine(nodeId: string, line: string): ScheduledMessage | null {
  const SEP = "—"; // Android code finds indexOf(SEPARATOR_DATE_MSG) and then substring +1
  const firstSpace = line.indexOf(" ");
  const dashIndex = line.indexOf(SEP);
  if (firstSpace === -1 || dashIndex === -1 || dashIndex < firstSpace) return null;
  const day = line.substring(0, firstSpace).trim();
  const time = line.substring(firstSpace + 1, dashIndex).trim();
  const msg = line.substring(dashIndex + 1).trim();
  return { nodeId, day, time, msg, toRemove: 0 };
}

export default ScheduledMessage;
