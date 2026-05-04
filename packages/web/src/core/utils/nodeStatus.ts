export const normalizeNodeStatus = (status?: string | null) => {
  const trimmed = status?.trim();
  return trimmed ? trimmed : undefined;
};

export const isNodeStatusUnread = (status?: string | null, lastReadStatus?: string | null) => {
  const normalizedStatus = normalizeNodeStatus(status);
  if (!normalizedStatus) {
    return false;
  }

  return normalizeNodeStatus(lastReadStatus) !== normalizedStatus;
};
