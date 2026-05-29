import type { Protobuf } from "@meshtastic/core";

type NodeErrorType = Protobuf.Mesh.Routing_Error | "MISMATCH_PKI" | "DUPLICATE_PKI";

type NodeError = {
  node: number;
  error: NodeErrorType;
};

type ProcessPacketParams = {
  from: number;
  snr: number;
  time: number;
  rxRssi?: number;
  hopStart?: number;
  hopLimit?: number;
};

export type { NodeError, ProcessPacketParams, NodeErrorType };
