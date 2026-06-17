import { useDarkMeshStore } from "@app/darkmesh/store.ts";
import { create, toBinary } from "@bufbuild/protobuf";
import { Protobuf, Types } from "@meshtastic/core";

/**
 * Helper to produce readable error messages from Error or plain objects.
 */
function formatError(e: unknown): string {
  if (e instanceof Error) {
    return e.stack ?? e.message;
  }
  try {
    // include non-enumerable props too when possible
    return JSON.stringify(e, Object.getOwnPropertyNames(e) as string[]);
  } catch {
    return String(e);
  }
}

function createNeighborInfoRequestPayload() {
  return toBinary(Protobuf.Mesh.NeighborInfoSchema, create(Protobuf.Mesh.NeighborInfoSchema));
}

type ConnectionLike = {
  traceRoute?: (nodeNum: number, priority?: Protobuf.Mesh.MeshPacket_Priority) => Promise<unknown>;
  requestEnvironmentTelemetry?: (nodeNum: number) => Promise<unknown>;
  requestNeighborInfo?: (nodeNum: number) => Promise<unknown>;
  sendPacket?: (
    payload: Uint8Array,
    portNum: Protobuf.Portnums.PortNum,
    destination: Types.Destination,
    channel?: Types.ChannelNumber,
    wantAck?: boolean,
    wantResponse?: boolean,
    echoResponse?: boolean,
    replyId?: number,
    emoji?: number,
  ) => Promise<unknown>;
  getMetadata?: (nodeNum: number) => Promise<unknown>;
};

export function requestNodeInfo(
  connection: ConnectionLike | undefined,
  nodeNum: number,
  onRequestError?: (error: unknown) => void,
) {
  if (!connection) {
    throw new Error("No connection available");
  }

  let request: Promise<unknown>;

  if (typeof connection.sendPacket === "function") {
    request = connection.sendPacket(
      new Uint8Array(),
      Protobuf.Portnums.PortNum.NODEINFO_APP,
      nodeNum,
      undefined,
      false,
      true,
    );
  } else if (typeof connection.getMetadata === "function") {
    request = connection.getMetadata(nodeNum);
  } else {
    throw new Error("NodeInfo request is not available on the current connection");
  }

  void request.catch((error) => {
    onRequestError?.(error);
  });
}

export async function startVisualTraceroute(
  deviceId: number,
  connection: ConnectionLike | undefined,
  nodeNum: number,
) {
  const darkMeshState = useDarkMeshStore.getState();
  darkMeshState.setPendingTraceRouteTarget(deviceId, nodeNum);
  darkMeshState.setSelectedTraceRoute(undefined);

  try {
    if (!connection || typeof connection.traceRoute !== "function") {
      throw new Error("Traceroute is not available on the current connection");
    }

    const priority = darkMeshState.tracePriorityByDevice?.[deviceId]
      ? Protobuf.Mesh.MeshPacket_Priority.MAX
      : Protobuf.Mesh.MeshPacket_Priority.UNSET;

    // `connection.traceRoute` returns the outgoing mesh packet id immediately,
    // matching the Android flow that records request timing before radio ACK.
    const requestId = (await connection.traceRoute(nodeNum, priority)) as number | undefined;
    if (typeof requestId === "number") {
      darkMeshState.setPendingTraceRouteRequest(deviceId, requestId);
    }

    window.setTimeout(() => {
      const state = useDarkMeshStore.getState();
      if (
        state.pendingTraceRouteTargetByDevice[deviceId] === nodeNum &&
        state.pendingTraceRouteRequestByDevice[deviceId] === requestId
      ) {
        state.setPendingTraceRouteTarget(deviceId, undefined);
        state.setPendingTraceRouteRequest(deviceId, undefined);
      }
    }, 90_000);
  } catch (error) {
    darkMeshState.setPendingTraceRouteTarget(deviceId, undefined);
    darkMeshState.setPendingTraceRouteRequest(deviceId, undefined);
    throw error;
  }
  // keep target and requestId set until response or timeout
}

export async function requestNeighborInfo(connection: ConnectionLike | undefined, nodeNum: number) {
  if (!connection) {
    throw new Error("No connection available");
  }

  // Prefer a connection helper if available (e.g., MeshDevice.requestNeighborInfo)
  // Attempt the helper, but fall back to raw sendPacket if it fails.
  if (typeof connection.requestNeighborInfo === "function") {
    try {
      await connection.requestNeighborInfo(nodeNum);
      return;
    } catch (err) {
      // If the helper failed, try a lower-level send as a fallback.
      const originalError: unknown = err;
      try {
        if (typeof connection.sendPacket === "function") {
          await connection.sendPacket(
            createNeighborInfoRequestPayload(),
            Protobuf.Portnums.PortNum.NEIGHBORINFO_APP,
            nodeNum,
          );
          return;
        }
      } catch (fallbackErr) {
        // If fallback also fails, throw a readable Error for UI to show
        throw new Error(
          `NeighborInfo helper failed: ${formatError(originalError)}; fallback sendPacket failed: ${formatError(
            fallbackErr,
          )}`,
        );
      }

      // If helper failed but no sendPacket fallback available, throw readable error
      throw new Error(formatError(originalError));
    }
  }

  // If no helper present, try raw sendPacket directly
  if (typeof connection.sendPacket === "function") {
    try {
      await connection.sendPacket(
        createNeighborInfoRequestPayload(),
        Protobuf.Portnums.PortNum.NEIGHBORINFO_APP,
        nodeNum,
      );
      return;
    } catch (err) {
      throw new Error(formatError(err));
    }
  }

  throw new Error("Neighbor info request is not available on the current connection");
}

export async function requestEnvironmentMetrics(
  connection: ConnectionLike | undefined,
  nodeNum: number,
) {
  if (connection && typeof connection.requestEnvironmentTelemetry === "function") {
    await connection.requestEnvironmentTelemetry(nodeNum);
    return;
  }

  if (connection && typeof connection.sendPacket === "function") {
    await connection.sendPacket(
      new Uint8Array(),
      Protobuf.Portnums.PortNum.TELEMETRY_APP,
      nodeNum,
      undefined,
      false,
      true,
    );
    return;
  }

  if (connection && typeof connection.getMetadata === "function") {
    await connection.getMetadata(nodeNum);
    return;
  }

  throw new Error("Environment request is not available on the current connection");
}

export async function requestDeviceMetadata(
  connection: ConnectionLike | undefined,
  nodeNum: number,
  adminChannel?: Types.ChannelNumber,
) {
  if (connection && typeof connection.sendPacket === "function") {
    const message = create(Protobuf.Admin.AdminMessageSchema, {
      payloadVariant: {
        case: "getDeviceMetadataRequest",
        value: true,
      },
    });

    await connection.sendPacket(
      toBinary(Protobuf.Admin.AdminMessageSchema, message),
      Protobuf.Portnums.PortNum.ADMIN_APP,
      nodeNum,
      adminChannel,
      false,
      true,
    );
    return;
  }

  if (connection && typeof connection.getMetadata === "function") {
    await connection.getMetadata(nodeNum);
    return;
  }

  throw new Error("Metadata request is not available on the current connection");
}
