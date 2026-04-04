import type { Protobuf } from "@meshtastic/core";

const mentionIdRegex = /^![0-9A-Fa-f]{8}$/;

export const mentionRegex = /@(![0-9A-Fa-f]{8})/g;

type MentionNode = Pick<Protobuf.Mesh.NodeInfo, "num" | "user">;

export type MessageMentionFragment =
  | { type: "text"; value: string }
  | { type: "mention"; value: string; mentionId: string };

export function buildMentionId(node?: MentionNode): string | undefined {
  const userId = node?.user?.id?.toUpperCase();
  if (userId && mentionIdRegex.test(userId)) {
    return userId;
  }

  if (typeof node?.num !== "number") {
    return undefined;
  }

  return `!${node.num.toString(16).toUpperCase().padStart(8, "0")}`;
}

export function buildNodeMention(node?: MentionNode): string | undefined {
  const mentionId = buildMentionId(node);
  return mentionId ? `@${mentionId}` : undefined;
}

export function splitMessageMentions(text: string): MessageMentionFragment[] {
  if (!text) {
    return [{ type: "text", value: "" }];
  }

  const fragments: MessageMentionFragment[] = [];
  let lastIndex = 0;
  mentionRegex.lastIndex = 0;

  for (const match of text.matchAll(mentionRegex)) {
    const index = match.index ?? -1;
    const mentionId = match[1]?.toUpperCase();
    const mentionText = match[0];

    if (index < 0 || !mentionId || !mentionText) {
      continue;
    }

    if (index > lastIndex) {
      fragments.push({
        type: "text",
        value: text.slice(lastIndex, index),
      });
    }

    fragments.push({
      type: "mention",
      value: mentionText,
      mentionId,
    });

    lastIndex = index + mentionText.length;
  }

  if (lastIndex < text.length) {
    fragments.push({
      type: "text",
      value: text.slice(lastIndex),
    });
  }

  return fragments.length > 0 ? fragments : [{ type: "text", value: text }];
}
