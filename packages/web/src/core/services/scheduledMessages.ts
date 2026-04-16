import { ScheduledMessage, parseLine, serializeLine } from "@core/models/scheduledMessage";

const PREF_PREFIX = "plannedMessages:";

/**
 * Load raw joined rules for nodeId (Android stores a single string per nodeId with \n-separated rules).
 */
export function loadRawRules(nodeId: string): string | null {
  return localStorage.getItem(PREF_PREFIX + nodeId);
}

export function saveRawRules(nodeId: string, joined: string | null): void {
  const key = PREF_PREFIX + nodeId;
  if (joined === null || joined.trim() === "") {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, joined);
  }
}

export function loadScheduledMessages(nodeId: string): ScheduledMessage[] {
  const raw = loadRawRules(nodeId);
  if (!raw) return [];
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const out: ScheduledMessage[] = [];
  for (const l of lines) {
    const parsed = parseLine(nodeId, l);
    if (parsed) out.push(parsed);
  }
  return out;
}

export function saveScheduledMessages(nodeId: string, msgs: ScheduledMessage[]): void {
  const joined = msgs.map(serializeLine).join("\n");
  saveRawRules(nodeId, joined);
}

export function addScheduledMessage(nodeId: string, msg: ScheduledMessage): void {
  const list = loadScheduledMessages(nodeId);
  list.push(msg);
  saveScheduledMessages(nodeId, list);
}

export function removeScheduledMessageByKey(nodeId: string, key: string): void {
  const list = loadScheduledMessages(nodeId).filter((m) => `${m.day} ${m.time} — ${m.msg}` !== key);
  saveScheduledMessages(nodeId, list);
}

export default {
  loadScheduledMessages,
  saveScheduledMessages,
  addScheduledMessage,
  removeScheduledMessageByKey,
};
