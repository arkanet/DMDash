import { useDarkMeshStore } from "@app/darkmesh/store.ts";
import { Protobuf } from "@meshtastic/core";

type ConnectionLike = {
  traceRoute?: (nodeNum: number) => Promise<unknown>;
  requestEnvironmentTelemetry?: (nodeNum: number) => Promise<unknown>;
  sendPacket?: (
    payload: Uint8Array,
    portNum: Protobuf.Portnums.PortNum,
    destination: number,
  ) => Promise<unknown>;
  getMetadata?: (nodeNum: number) => Promise<unknown>;
};

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

    // `connection.traceRoute` returns the packet id for the sent traceroute
    // (see MeshDevice.sendPacket implementation). Capture it so we can match
    // incoming traceroute responses by request id.
    const requestId = (await connection.traceRoute(nodeNum)) as number | undefined;
    if (typeof requestId === "number") {
      darkMeshState.setPendingTraceRouteRequest(deviceId, requestId);
    }
  } catch (error) {
    darkMeshState.setPendingTraceRouteTarget(deviceId, undefined);
    darkMeshState.setPendingTraceRouteRequest(deviceId, undefined);
    throw error;
  }
  // keep target and requestId set until response or timeout
}

export async function requestNeighborInfo(connection: ConnectionLike | undefined, nodeNum: number) {
  if (!connection || typeof connection.sendPacket !== "function") {
    throw new Error("Neighbor info request is not available on the current connection");
  }

  await connection.sendPacket(
    new Uint8Array(),
    Protobuf.Portnums.PortNum.NEIGHBORINFO_APP,
    nodeNum,
  );
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
    await connection.sendPacket(new Uint8Array(), Protobuf.Portnums.PortNum.TELEMETRY_APP, nodeNum);
    return;
  }

  if (connection && typeof connection.getMetadata === "function") {
    await connection.getMetadata(nodeNum);
    return;
  }

  throw new Error("Environment request is not available on the current connection");
}
