import { create } from "@bufbuild/protobuf";
import { featureFlags } from "@core/services/featureFlags";
import { validateIncomingNode } from "@core/stores/nodeDBStore/nodeValidation";
import { createStorage } from "@core/stores/utils/indexDB.ts";
import * as nodeinfoPersistence from "@core/stores/nodeinfoPersistence";
import { Protobuf, type Types } from "@meshtastic/core";
import { distanceBetweenPositions, normalizePosition } from "@core/utils/geo.ts";

type NodeInfoWithRx = Protobuf.Mesh.NodeInfo & { rxRssi?: number };
type NodeInfoWithExtras = Protobuf.Mesh.NodeInfo & { distanceKm?: number };
import { produce } from "immer";
import { create as createStore, type StateCreator } from "zustand";
import { type PersistOptions, persist, subscribeWithSelector } from "zustand/middleware";
import type { NodeError, NodeErrorType, ProcessPacketParams } from "./types.ts";

const IDB_KEY_NAME = "meshtastic-nodedb-store";
const CURRENT_STORE_VERSION = 0;
const NODE_RETENTION_DAYS = 14; // Remove nodes not heard from in 14 days

type NodeDBData = {
  // Persisted data
  id: number;
  myNodeNum: number | undefined;
  nodeMap: Map<number, Protobuf.Mesh.NodeInfo>;
  nodeErrors: Map<number, NodeError>;
  nodeIndex?: number[];
};

export interface NodeDB extends NodeDBData {
  environmentMetricsMap: Map<number, Protobuf.Telemetry.EnvironmentMetrics>;
  // Ephemeral state (not persisted)
  addNode: (nodeInfo: Protobuf.Mesh.NodeInfo) => void;
  removeNode: (nodeNum: number) => void;
  removeAllNodes: (keepMyNode?: boolean) => void;
  pruneStaleNodes: (skipFavorites?: boolean) => number;
  /** Prune nodes older than the specified days. Returns number pruned. */
  pruneStaleNodesWithDays?: (days: number, skipFavorites?: boolean) => number;
  /** Configure whether pruning should skip favorite nodes */
  skipFavoritesDuringPrune?: boolean;
  /** Setter to persist preference for skipping favorites during prune */
  setPruneSkipFavorites: (skip: boolean) => void;
  processPacket: (data: ProcessPacketParams) => void;
  addTelemetry: (telemetry: Types.PacketMetadata<Protobuf.Telemetry.Telemetry>) => void;
  addUser: (user: Types.PacketMetadata<Protobuf.Mesh.User>) => void;
  addPosition: (position: Types.PacketMetadata<Protobuf.Mesh.Position>) => void;
  updateFavorite: (nodeNum: number, isFavorite: boolean) => void;
  updateIgnore: (nodeNum: number, isIgnored: boolean) => void;
  setNodeNum: (nodeNum: number) => void;
  setNodeError: (nodeNum: number, error: NodeErrorType) => void;
  clearNodeError: (nodeNum: number) => void;
  removeAllNodeErrors: () => void;

  getNodesLength: () => number;
  getNode: (nodeNum: number) => Protobuf.Mesh.NodeInfo | undefined;
  getNodes: (
    filter?: (node: Protobuf.Mesh.NodeInfo) => boolean,
    includeSelf?: boolean,
  ) => Protobuf.Mesh.NodeInfo[];
  getMyNode: () => Protobuf.Mesh.NodeInfo | undefined;
  getEnvironmentMetrics: (nodeNum: number) => Protobuf.Telemetry.EnvironmentMetrics | undefined;

  getNodeError: (nodeNum: number) => NodeError | undefined;
  hasNodeError: (nodeNum: number) => boolean;
}

export interface nodeDBState {
  addNodeDB: (id: number) => NodeDB;
  removeNodeDB: (id: number) => void;
  getNodeDBs: () => NodeDB[];
  getNodeDB: (id: number) => NodeDB | undefined;
}

interface PrivateNodeDBState extends nodeDBState {
  nodeDBs: Map<number, NodeDB>;
}

type NodeDBPersisted = {
  nodeDBs: Map<number, NodeDBData>;
};

function nodeDBFactory(
  id: number,
  get: () => PrivateNodeDBState,
  set: typeof useNodeDBStore.setState,
  data?: Partial<NodeDBData>,
): NodeDB {
  const nodeMap = data?.nodeMap ?? new Map<number, Protobuf.Mesh.NodeInfo>();
  const nodeErrors = data?.nodeErrors ?? new Map<number, NodeError>();
  const myNodeNum = data?.myNodeNum;
  const environmentMetricsMap = new Map<number, Protobuf.Telemetry.EnvironmentMetrics>();

  return {
    id,
    myNodeNum,
    nodeMap,
    nodeErrors,
    environmentMetricsMap,
    // whether to skip favorite nodes when pruning (in-memory preference)
    skipFavoritesDuringPrune: false,
    setPruneSkipFavorites: (skip: boolean) =>
      set(
        produce<PrivateNodeDBState>((draft) => {
          const nodeDB = draft.nodeDBs.get(id);
          if (!nodeDB) {
            throw new Error(`No nodeDB found (id: ${id})`);
          }
          nodeDB.skipFavoritesDuringPrune = skip;
        }),
      ),

    addNode: (node) => {
      // apply normalization to node.position if present
      if (node.position) {
        node.position = normalizePosition(node.position);
      }
      set(
        produce<PrivateNodeDBState>((draft) => {
          const nodeDB = draft.nodeDBs.get(id);
          if (!nodeDB) {
            throw new Error(`No nodeDB found (id: ${id})`);
          }

          // Check if node already exists
          const existing = nodeDB.nodeMap.get(node.num);
          const isNew = !existing;

          // Use validation to check the new node before adding
          const next = validateIncomingNode(
            node,
            (nodeNum: number, err: NodeErrorType) => {
              nodeDB.setNodeError(nodeNum, err);
            },
            (filter?: (node: Protobuf.Mesh.NodeInfo) => boolean) => nodeDB.getNodes(filter, true),
          );

          if (!next) {
            // Validation failed and error has been set inside validateIncomingNode
            return;
          }

          // Merge with existing node data if it exists
          const merged = existing
            ? {
                ...existing,
                ...next,
                // Preserve existing fields if new node doesn't have them
                user: next.user ?? existing.user,
                position: next.position ?? existing.position,
                deviceMetrics: next.deviceMetrics ?? existing.deviceMetrics,
              }
            : next;

          // Compute server-side distanceKm if both myNode and this node have positions
          const myNode = nodeDB.myNodeNum ? nodeDB.nodeMap.get(nodeDB.myNodeNum) : undefined;
          if (myNode?.position && merged.position) {
            const d = distanceBetweenPositions(myNode.position, merged.position);
            if (d !== undefined) {
              (merged as NodeInfoWithExtras).distanceKm = Math.round(d * 100) / 100;
            } else {
              delete (merged as NodeInfoWithExtras).distanceKm;
            }
          } else {
            delete (merged as NodeInfoWithExtras).distanceKm;
          }

          // Use the validated node's num to ensure consistency
          nodeDB.nodeMap = new Map(nodeDB.nodeMap).set(merged.num, merged);

          // If we added/updated our local node's position, recompute distances for all nodes
          if (nodeDB.myNodeNum === merged.num && merged.position) {
            const myPos = merged.position;
            const recomputed = new Map<number, Protobuf.Mesh.NodeInfo>(nodeDB.nodeMap);
            for (const [nNum, nNode] of recomputed) {
              if (nNode.position) {
                const d = distanceBetweenPositions(myPos, nNode.position);
                if (d !== undefined) {
                  (nNode as NodeInfoWithExtras).distanceKm = Math.round(d * 100) / 100;
                } else {
                  delete (nNode as NodeInfoWithExtras).distanceKm;
                }
              } else {
                delete (nNode as NodeInfoWithExtras).distanceKm;
              }
              recomputed.set(nNum, nNode);
            }
            nodeDB.nodeMap = recomputed;
          }

          if (isNew) {
            console.log(
              `[NodeDB] Adding new node from NodeInfo packet: ${merged.num} (${merged.user?.longName || "unknown"})`,
            );
          } else {
            console.log(
              `[NodeDB] Updating existing node from NodeInfo packet: ${merged.num} (${merged.user?.longName || "unknown"})`,
            );
          }
        }),
      );

      // Persist the added/updated node asynchronously
      try {
        const persisted = get().nodeDBs.get(id)?.nodeMap.get(node.num);
        if (persisted) {
          nodeinfoPersistence
            .putNode(id, persisted)
            .catch((_e) => console.warn("nodeinfoPersistence.putNode failed", _e));
        }
      } catch (e) {
        console.warn("nodeinfoPersistence: failed to persist node after addNode", e);
      }
    },

    removeNode: (nodeNum) => {
      set(
        produce<PrivateNodeDBState>((draft) => {
          const nodeDB = draft.nodeDBs.get(id);
          if (!nodeDB) {
            throw new Error(`No nodeDB found (id: ${id})`);
          }
          const updated = new Map(nodeDB.nodeMap);
          updated.delete(nodeNum);
          nodeDB.nodeMap = updated;
        }),
      );

      nodeinfoPersistence
        .deleteNode(id, nodeNum)
        .catch((_e) => console.warn("nodeinfoPersistence.deleteNode failed", _e));
    },

    removeAllNodes: (keepMyNode) => {
      set(
        produce<PrivateNodeDBState>((draft) => {
          const nodeDB = draft.nodeDBs.get(id);
          if (!nodeDB) {
            throw new Error(`No nodeDB found (id: ${id})`);
          }
          const newNodeMap = new Map<number, Protobuf.Mesh.NodeInfo>();
          if (
            keepMyNode &&
            nodeDB.myNodeNum !== undefined &&
            nodeDB.nodeMap.has(nodeDB.myNodeNum)
          ) {
            newNodeMap.set(
              nodeDB.myNodeNum,
              nodeDB.nodeMap.get(nodeDB.myNodeNum) ?? create(Protobuf.Mesh.NodeInfoSchema),
            );
          }
          nodeDB.nodeMap = newNodeMap;
          nodeDB.environmentMetricsMap = keepMyNode
            ? new Map(
                nodeDB.myNodeNum !== undefined && nodeDB.environmentMetricsMap.has(nodeDB.myNodeNum)
                  ? [
                      [
                        nodeDB.myNodeNum,
                        nodeDB.environmentMetricsMap.get(nodeDB.myNodeNum) ??
                          create(Protobuf.Telemetry.EnvironmentMetricsSchema),
                      ],
                    ]
                  : [],
              )
            : new Map<number, Protobuf.Telemetry.EnvironmentMetrics>();
        }),
      );

      if (!keepMyNode) {
        nodeinfoPersistence
          .clearDb(id)
          .catch((_e) => console.warn("nodeinfoPersistence.clearDb failed", _e));
      } else {
        // keep only myNode persisted
        try {
          const myNode = get()
            .nodeDBs.get(id)
            ?.nodeMap.get(get().nodeDBs.get(id)!.myNodeNum ?? -1);
          nodeinfoPersistence
            .clearDb(id)
            .then(() => {
              if (myNode) {
                return nodeinfoPersistence.putNode(id, myNode);
              }
            })
            .catch((_e) => console.warn("nodeinfoPersistence.clearDb+put failed", _e));
        } catch (e) {
          console.warn("nodeinfoPersistence: error during removeAllNodes persistence", e);
        }
      }
    },

    pruneStaleNodes: (skipFavorites?: boolean) => {
      const nodeDB = get().nodeDBs.get(id);
      if (!nodeDB) {
        throw new Error(`No nodeDB found (id: ${id})`);
      }
      const nodeSkipFav =
        typeof skipFavorites === "boolean"
          ? skipFavorites
          : (nodeDB.skipFavoritesDuringPrune ?? false);

      const nowSec = Math.floor(Date.now() / 1000);
      const cutoffSec = nowSec - NODE_RETENTION_DAYS * 24 * 60 * 60;
      let prunedCount = 0;

      set(
        produce<PrivateNodeDBState>((draft) => {
          const nodeDB = draft.nodeDBs.get(id);
          if (!nodeDB) {
            throw new Error(`No nodeDB found (id: ${id})`);
          }

          const newNodeMap = new Map<number, Protobuf.Mesh.NodeInfo>();

          for (const [nodeNum, node] of nodeDB.nodeMap) {
            // Optionally skip favorites when pruning
            const isFav = Boolean(node.isFavorite);

            // Keep myNode regardless of lastHeard
            // Keep nodes that have been heard recently
            // Keep nodes without lastHeard (just in case)
            if (
              nodeNum === nodeDB.myNodeNum ||
              !node.lastHeard ||
              node.lastHeard >= cutoffSec ||
              (nodeSkipFav && isFav)
            ) {
              newNodeMap.set(nodeNum, node);
            } else {
              prunedCount++;
              console.log(
                `[NodeDB] Pruning stale node ${nodeNum} (last heard ${Math.floor((nowSec - node.lastHeard) / 86400)} days ago)`,
              );
            }
          }

          nodeDB.nodeMap = newNodeMap;
        }),
      );

      if (prunedCount > 0) {
        console.log(
          `[NodeDB] Pruned ${prunedCount} stale node(s) older than ${NODE_RETENTION_DAYS} days`,
        );
      }

      return prunedCount;
    },
    // prune with configurable days (not persisted)
    pruneStaleNodesWithDays: (days: number, skipFavorites?: boolean) => {
      const nodeDB = get().nodeDBs.get(id);
      if (!nodeDB) {
        throw new Error(`No nodeDB found (id: ${id})`);
      }
      const nodeSkipFav =
        typeof skipFavorites === "boolean"
          ? skipFavorites
          : (nodeDB.skipFavoritesDuringPrune ?? false);

      const nowSec = Math.floor(Date.now() / 1000);
      const cutoffSec = nowSec - days * 24 * 60 * 60;
      let prunedCount = 0;

      set(
        produce<PrivateNodeDBState>((draft) => {
          const nodeDB = draft.nodeDBs.get(id);
          if (!nodeDB) {
            throw new Error(`No nodeDB found (id: ${id})`);
          }

          const newNodeMap = new Map<number, Protobuf.Mesh.NodeInfo>();

          for (const [nodeNum, node] of nodeDB.nodeMap) {
            const isFav = Boolean(node.isFavorite);
            if (
              nodeNum === nodeDB.myNodeNum ||
              !node.lastHeard ||
              node.lastHeard >= cutoffSec ||
              (nodeSkipFav && isFav)
            ) {
              newNodeMap.set(nodeNum, node);
            } else {
              prunedCount++;
              console.log(
                `[NodeDB] Pruning stale node ${nodeNum} (last heard ${Math.floor((nowSec - node.lastHeard) / 86400)} days ago)`,
              );
            }
          }

          nodeDB.nodeMap = newNodeMap;
        }),
      );

      if (prunedCount > 0) {
        console.log(`[NodeDB] Pruned ${prunedCount} stale node(s) older than ${days} days`);
      }

      return prunedCount;
    },

    setNodeError: (nodeNum, error) =>
      set(
        produce<PrivateNodeDBState>((draft) => {
          const nodeDB = draft.nodeDBs.get(id);
          if (!nodeDB) {
            throw new Error(`No nodeDB found (id: ${id})`);
          }
          nodeDB.nodeErrors = new Map(nodeDB.nodeErrors).set(nodeNum, {
            node: nodeNum,
            error,
          });
        }),
      ),

    clearNodeError: (nodeNum) =>
      set(
        produce<PrivateNodeDBState>((draft) => {
          const nodeDB = draft.nodeDBs.get(id);
          if (!nodeDB) {
            throw new Error(`No nodeDB found (id: ${id})`);
          }
          const updated = new Map(nodeDB.nodeErrors);
          updated.delete(nodeNum);
          nodeDB.nodeErrors = updated;
        }),
      ),

    removeAllNodeErrors: () =>
      set(
        produce<PrivateNodeDBState>((draft) => {
          const nodeDB = draft.nodeDBs.get(id);
          if (!nodeDB) {
            throw new Error(`No nodeDB found (id: ${id})`);
          }
          nodeDB.nodeErrors = new Map<number, NodeError>();
        }),
      ),

    processPacket: (data) => {
      set(
        produce<PrivateNodeDBState>((draft) => {
          const nodeDB = draft.nodeDBs.get(id);
          if (!nodeDB) {
            throw new Error(`No nodeDB found (id: ${id})`);
          }
          const existingNode = nodeDB.nodeMap.get(data.from);
          const nowSec = Math.floor(Date.now() / 1000); // lastHeard is in seconds(!)

          // Helpers for validation
          const setNodeErrorProxy = (nodeNum: number, err: NodeErrorType) => {
            nodeDB.setNodeError(nodeNum, err);
          };
          const getNodesProxy = (filter?: (node: Protobuf.Mesh.NodeInfo) => boolean) => {
            const arr = Array.from(nodeDB.nodeMap.values());
            return filter ? arr.filter(filter) : arr;
          };

          if (existingNode) {
            const updated: NodeInfoWithRx = {
              ...existingNode,
              lastHeard: data.time > 0 ? data.time : nowSec,
              snr: data.snr,
              // rxRssi is optional — prefer new value when present
              rxRssi: data.rxRssi != null ? data.rxRssi : (existingNode as NodeInfoWithRx).rxRssi,
            };

            const next = validateIncomingNode(
              updated as Protobuf.Mesh.NodeInfo,
              setNodeErrorProxy,
              getNodesProxy,
            );
            if (!next) {
              // validation rejected the update; don't modify store
              return;
            }

            // compute server-side distance if possible
            const myNode = nodeDB.myNodeNum ? nodeDB.nodeMap.get(nodeDB.myNodeNum) : undefined;
            const computed = next as NodeInfoWithExtras;
            if (myNode?.position && computed.position) {
              const d = distanceBetweenPositions(myNode.position, computed.position);
              if (d !== undefined) {
                computed.distanceKm = Math.round(d * 100) / 100;
              } else {
                delete computed.distanceKm;
              }
            } else {
              delete computed.distanceKm;
            }

            nodeDB.nodeMap = new Map(nodeDB.nodeMap).set(
              data.from,
              computed as Protobuf.Mesh.NodeInfo,
            );
          } else {
            // create a minimal NodeInfo message via the protobuf helper so it has the required $typeName
            const createdMsg = create(Protobuf.Mesh.NodeInfoSchema, {
              num: data.from,
              lastHeard: data.time > 0 ? data.time : nowSec,
              snr: data.snr,
            });
            if (data.rxRssi != null) {
              // narrow to extended type to set rxRssi (no `any` cast)
              (createdMsg as unknown as NodeInfoWithRx).rxRssi = data.rxRssi;
            }

            const next = validateIncomingNode(
              createdMsg as Protobuf.Mesh.NodeInfo,
              setNodeErrorProxy,
              getNodesProxy,
            );
            if (!next) {
              return;
            }

            const computedNew = next as NodeInfoWithExtras;
            const myNode2 = nodeDB.myNodeNum ? nodeDB.nodeMap.get(nodeDB.myNodeNum) : undefined;
            if (myNode2?.position && computedNew.position) {
              const d = distanceBetweenPositions(myNode2.position, computedNew.position);
              if (d !== undefined) {
                computedNew.distanceKm = Math.round(d * 100) / 100;
              } else {
                delete computedNew.distanceKm;
              }
            } else {
              delete computedNew.distanceKm;
            }

            nodeDB.nodeMap = new Map(nodeDB.nodeMap).set(
              data.from,
              computedNew as Protobuf.Mesh.NodeInfo,
            );
          }
        }),
      );

      // persist updated node
      try {
        const persisted = get().nodeDBs.get(id)?.nodeMap.get(data.from);
        if (persisted) {
          nodeinfoPersistence
            .putNode(id, persisted)
            .catch((_e) => console.warn("nodeinfoPersistence.putNode failed", _e));
        }
      } catch (e) {
        console.warn("nodeinfoPersistence: failed to persist node after processPacket", e);
      }
    },

    addTelemetry: (telemetry) => {
      set(
        produce<PrivateNodeDBState>((draft) => {
          const nodeDB = draft.nodeDBs.get(id);
          if (!nodeDB) {
            throw new Error(`No nodeDB found (id: ${id})`);
          }

          const current = nodeDB.nodeMap.get(telemetry.from);
          const nowSec = Math.floor(Date.now() / 1000);
          const telemetryTimeSec = Math.floor(telemetry.rxTime.getTime() / 1000);
          const baseNode =
            current ??
            create(Protobuf.Mesh.NodeInfoSchema, {
              num: telemetry.from,
              lastHeard: telemetryTimeSec > 0 ? telemetryTimeSec : nowSec,
              snr: telemetry.rxSnr ?? 0,
            });

          const updatedNode = {
            ...baseNode,
            num: telemetry.from,
            lastHeard: telemetryTimeSec > 0 ? telemetryTimeSec : baseNode.lastHeard,
            snr: telemetry.rxSnr ?? baseNode.snr,
            deviceMetrics:
              telemetry.data.variant.case === "deviceMetrics"
                ? telemetry.data.variant.value
                : baseNode.deviceMetrics,
          };

          // validation helpers
          const setNodeErrorProxy = (nodeNum: number, err: NodeErrorType) => {
            nodeDB.setNodeError(nodeNum, err);
          };
          const getNodesProxy = (filter?: (node: Protobuf.Mesh.NodeInfo) => boolean) => {
            const arr = Array.from(nodeDB.nodeMap.values());
            return filter ? arr.filter(filter) : arr;
          };

          const next = validateIncomingNode(
            updatedNode as Protobuf.Mesh.NodeInfo,
            setNodeErrorProxy,
            getNodesProxy,
          );
          if (!next) {
            return;
          }

          // compute server-side distance when telemetry includes position info
          const computedTelemetry = next as NodeInfoWithExtras;
          const myNode = nodeDB.myNodeNum ? nodeDB.nodeMap.get(nodeDB.myNodeNum) : undefined;
          if (myNode?.position && computedTelemetry.position) {
            const d = distanceBetweenPositions(myNode.position, computedTelemetry.position);
            if (d !== undefined) {
              computedTelemetry.distanceKm = Math.round(d * 100) / 100;
            } else {
              delete computedTelemetry.distanceKm;
            }
          } else {
            delete computedTelemetry.distanceKm;
          }

          nodeDB.nodeMap = new Map(nodeDB.nodeMap).set(
            telemetry.from,
            computedTelemetry as Protobuf.Mesh.NodeInfo,
          );

          if (telemetry.data.variant.case === "environmentMetrics") {
            nodeDB.environmentMetricsMap = new Map(nodeDB.environmentMetricsMap).set(
              telemetry.from,
              telemetry.data.variant.value,
            );
          }
        }),
      );

      try {
        const persisted = get().nodeDBs.get(id)?.nodeMap.get(telemetry.from);
        if (persisted) {
          nodeinfoPersistence
            .putNode(id, persisted)
            .catch((_e) => console.warn("nodeinfoPersistence.putNode failed", _e));
        }
      } catch (e) {
        console.warn("nodeinfoPersistence: failed to persist node after addTelemetry", e);
      }
    },

    addUser: (user) => {
      set(
        produce<PrivateNodeDBState>((draft) => {
          const nodeDB = draft.nodeDBs.get(id);
          if (!nodeDB) {
            throw new Error(`No nodeDB found (id: ${id})`);
          }
          const current = nodeDB.nodeMap.get(user.from);
          const isNew = !current;
          const updated = {
            ...(current ?? create(Protobuf.Mesh.NodeInfoSchema)),
            user: user.data,
            num: user.from,
          };

          const setNodeErrorProxy = (nodeNum: number, err: NodeErrorType) => {
            nodeDB.setNodeError(nodeNum, err);
          };
          const getNodesProxy = (filter?: (node: Protobuf.Mesh.NodeInfo) => boolean) => {
            const arr = Array.from(nodeDB.nodeMap.values());
            return filter ? arr.filter(filter) : arr;
          };

          const next = validateIncomingNode(
            updated as Protobuf.Mesh.NodeInfo,
            setNodeErrorProxy,
            getNodesProxy,
          );
          if (!next) return;

          const computedUser = next as NodeInfoWithExtras;
          const myNode = nodeDB.myNodeNum ? nodeDB.nodeMap.get(nodeDB.myNodeNum) : undefined;
          if (myNode?.position && computedUser.position) {
            const d = distanceBetweenPositions(myNode.position, computedUser.position);
            if (d !== undefined) {
              computedUser.distanceKm = Math.round(d * 100) / 100;
            } else {
              delete computedUser.distanceKm;
            }
          } else {
            delete computedUser.distanceKm;
          }

          nodeDB.nodeMap = new Map(nodeDB.nodeMap).set(
            user.from,
            computedUser as Protobuf.Mesh.NodeInfo,
          );

          if (isNew) {
            console.log(
              `[NodeDB] Adding new node from user packet: ${user.from} (${user.data.longName || "unknown"})`,
            );
          }
        }),
      );

      try {
        const persisted = get().nodeDBs.get(id)?.nodeMap.get(user.from);
        if (persisted) {
          nodeinfoPersistence
            .putNode(id, persisted)
            .catch((_e) => console.warn("nodeinfoPersistence.putNode failed", _e));
        }
      } catch (e) {
        console.warn("nodeinfoPersistence: failed to persist node after addUser", e);
      }
    },

    addPosition: (position) => {
      set(
        produce<PrivateNodeDBState>((draft) => {
          const nodeDB = draft.nodeDBs.get(id);
          if (!nodeDB) {
            throw new Error(`No nodeDB found (id: ${id})`);
          }
          const current = nodeDB.nodeMap.get(position.from);
          const isNew = !current;
          const updated = {
            ...(current ?? create(Protobuf.Mesh.NodeInfoSchema)),
            position: normalizePosition(position.data),
            num: position.from,
          };

          const setNodeErrorProxy = (nodeNum: number, err: NodeErrorType) => {
            nodeDB.setNodeError(nodeNum, err);
          };
          const getNodesProxy = (filter?: (node: Protobuf.Mesh.NodeInfo) => boolean) => {
            const arr = Array.from(nodeDB.nodeMap.values());
            return filter ? arr.filter(filter) : arr;
          };

          const next = validateIncomingNode(
            updated as Protobuf.Mesh.NodeInfo,
            setNodeErrorProxy,
            getNodesProxy,
          );
          if (!next) return;

          const computedPos = next as NodeInfoWithExtras;
          const myNode = nodeDB.myNodeNum ? nodeDB.nodeMap.get(nodeDB.myNodeNum) : undefined;
          if (myNode?.position && computedPos.position) {
            const d = distanceBetweenPositions(myNode.position, computedPos.position);
            if (d !== undefined) {
              computedPos.distanceKm = Math.round(d * 100) / 100;
            } else {
              delete computedPos.distanceKm;
            }
          } else {
            delete computedPos.distanceKm;
          }

          nodeDB.nodeMap = new Map(nodeDB.nodeMap).set(
            position.from,
            computedPos as Protobuf.Mesh.NodeInfo,
          );

          // If the position we updated is our local node, recompute distances for all nodes
          if (nodeDB.myNodeNum === position.from && computedPos.position) {
            const myPos = computedPos.position;
            const recomputed = new Map<number, Protobuf.Mesh.NodeInfo>(nodeDB.nodeMap);
            for (const [nNum, nNode] of recomputed) {
              if (nNode.position) {
                const d = distanceBetweenPositions(myPos, nNode.position);
                if (d !== undefined) {
                  (nNode as NodeInfoWithExtras).distanceKm = Math.round(d * 100) / 100;
                } else {
                  delete (nNode as NodeInfoWithExtras).distanceKm;
                }
              } else {
                delete (nNode as NodeInfoWithExtras).distanceKm;
              }
              recomputed.set(nNum, nNode);
            }
            nodeDB.nodeMap = recomputed;
          }

          if (isNew) {
            console.log(`[NodeDB] Adding new node from position packet: ${position.from}`);
          }
        }),
      );

      try {
        const persisted = get().nodeDBs.get(id)?.nodeMap.get(position.from);
        if (persisted) {
          nodeinfoPersistence
            .putNode(id, persisted)
            .catch((_e) => console.warn("nodeinfoPersistence.putNode failed", _e));
        }
      } catch (e) {
        console.warn("nodeinfoPersistence: failed to persist node after addPosition", e);
      }
    },

    setNodeNum: (nodeNum) =>
      set(
        produce<PrivateNodeDBState>((draft) => {
          const newDB = draft.nodeDBs.get(id);
          if (!newDB) {
            throw new Error(`No nodeDB found for id: ${id}`);
          }

          newDB.myNodeNum = nodeNum;

          for (const [key, oldDB] of draft.nodeDBs) {
            if (key === id) {
              // short-circuit self
              continue;
            }
            if (oldDB.myNodeNum === nodeNum) {
              // We found the oldDB (same myNodeNum). Merge node-by-node as if the new nodes are added with addNode

              const mergedNodes = new Map(oldDB.nodeMap);
              const mergedErrors = new Map(oldDB.nodeErrors);
              const mergedEnvironmentMetrics = new Map(oldDB.environmentMetricsMap);

              const getNodesProxy = (
                filter?: (node: Protobuf.Mesh.NodeInfo) => boolean,
              ): Protobuf.Mesh.NodeInfo[] => {
                const arr = Array.from(mergedNodes.values());
                return filter ? arr.filter(filter) : arr;
              };

              const setErrorProxy = (nodeNum: number, err: NodeErrorType) => {
                mergedErrors.set(nodeNum, {
                  node: nodeNum,
                  error: err,
                });
              };

              for (const [num, newNode] of newDB.nodeMap) {
                const next = validateIncomingNode(newNode, setErrorProxy, getNodesProxy);
                if (next) {
                  // compute distance if possible using mergedNodes (best-effort)
                  const computedNext = next as NodeInfoWithExtras;
                  const myNode = mergedNodes.get(newDB.myNodeNum ?? -1);
                  if (myNode?.position && computedNext.position) {
                    const d = distanceBetweenPositions(myNode.position, computedNext.position);
                    if (d !== undefined) {
                      computedNext.distanceKm = Math.round(d * 100) / 100;
                    } else {
                      delete computedNext.distanceKm;
                    }
                  } else {
                    delete computedNext.distanceKm;
                  }

                  mergedNodes.set(num, computedNext);
                }

                const err = newDB.getNodeError(num);
                if (err && !oldDB.hasNodeError(num)) {
                  mergedErrors.set(num, err);
                }
              }

              for (const [num, metrics] of newDB.environmentMetricsMap) {
                mergedEnvironmentMetrics.set(num, metrics);
              }

              // finalize: move maps into newDB and drop oldDB entry
              newDB.nodeMap = mergedNodes;
              // If we have myNode position after merge, recompute distances for all nodes
              const myNodeAfter = newDB.myNodeNum ? newDB.nodeMap.get(newDB.myNodeNum) : undefined;
              if (myNodeAfter?.position) {
                const recomputed = new Map<number, Protobuf.Mesh.NodeInfo>(newDB.nodeMap);
                for (const [nNum, nNode] of recomputed) {
                  if (nNode.position) {
                    const d = distanceBetweenPositions(myNodeAfter.position, nNode.position);
                    if (d !== undefined) {
                      (nNode as NodeInfoWithExtras).distanceKm = Math.round(d * 100) / 100;
                    } else {
                      delete (nNode as NodeInfoWithExtras).distanceKm;
                    }
                  } else {
                    delete (nNode as NodeInfoWithExtras).distanceKm;
                  }
                  recomputed.set(nNum, nNode);
                }
                newDB.nodeMap = recomputed;
              }
              newDB.nodeErrors = mergedErrors;
              newDB.environmentMetricsMap = mergedEnvironmentMetrics;
              draft.nodeDBs.delete(oldDB.id);
            }
          }
        }),
      ),

    updateFavorite: (nodeNum, isFavorite) => {
      set(
        produce<PrivateNodeDBState>((draft) => {
          const nodeDB = draft.nodeDBs.get(id);
          if (!nodeDB) {
            throw new Error(`No nodeDB found (id: ${id})`);
          }

          const node = nodeDB.nodeMap.get(nodeNum);
          if (node) {
            nodeDB.nodeMap = new Map(nodeDB.nodeMap).set(nodeNum, {
              ...node,
              isFavorite: isFavorite,
            });
          }
        }),
      );

      try {
        const persisted = get().nodeDBs.get(id)?.nodeMap.get(nodeNum);
        if (persisted) {
          nodeinfoPersistence
            .putNode(id, persisted)
            .catch((_e) => console.warn("nodeinfoPersistence.putNode failed", _e));
        }
      } catch (e) {
        console.warn("nodeinfoPersistence: failed to persist node after updateFavorite", e);
      }
    },

    updateIgnore: (nodeNum, isIgnored) => {
      set(
        produce<PrivateNodeDBState>((draft) => {
          const nodeDB = draft.nodeDBs.get(id);
          if (!nodeDB) {
            throw new Error(`No nodeDB found (id: ${id})`);
          }

          const node = nodeDB.nodeMap.get(nodeNum);
          if (node) {
            nodeDB.nodeMap = new Map(nodeDB.nodeMap).set(nodeNum, {
              ...node,
              isIgnored: isIgnored,
            });
          }
        }),
      );

      try {
        const persisted = get().nodeDBs.get(id)?.nodeMap.get(nodeNum);
        if (persisted) {
          nodeinfoPersistence
            .putNode(id, persisted)
            .catch((e) => console.warn("nodeinfoPersistence.putNode failed", e));
        }
      } catch (e) {
        console.warn("nodeinfoPersistence: failed to persist node after updateIgnore", e);
      }
    },

    getNodesLength: () => {
      const nodeDB = get().nodeDBs.get(id);
      if (!nodeDB) {
        throw new Error(`No nodeDB found (id: ${id})`);
      }
      return nodeDB.nodeMap.size;
    },

    getNode: (nodeNum) => {
      const nodeDB = get().nodeDBs.get(id);
      if (!nodeDB) {
        throw new Error(`No nodeDB found (id: ${id})`);
      }
      return nodeDB.nodeMap.get(nodeNum);
    },

    getNodes: (filter, includeSelf) => {
      const nodeDB = get().nodeDBs.get(id);
      if (!nodeDB) {
        throw new Error(`No nodeDB found (id: ${id})`);
      }
      const all = Array.from(nodeDB.nodeMap.values()).filter((n) =>
        includeSelf ? true : n.num !== nodeDB.myNodeNum,
      );

      return filter ? all.filter(filter) : all;
    },

    getMyNode: () => {
      const nodeDB = get().nodeDBs.get(id);
      if (!nodeDB) {
        throw new Error(`No nodeDB found (id: ${id})`);
      }
      if (nodeDB.myNodeNum) {
        return nodeDB.nodeMap.get(nodeDB.myNodeNum) ?? create(Protobuf.Mesh.NodeInfoSchema);
      }
    },

    getEnvironmentMetrics: (nodeNum) => {
      const nodeDB = get().nodeDBs.get(id);
      if (!nodeDB) {
        throw new Error(`No nodeDB found (id: ${id})`);
      }

      return nodeDB.environmentMetricsMap.get(nodeNum);
    },

    getNodeError: (nodeNum) => {
      const nodeDB = get().nodeDBs.get(id);
      if (!nodeDB) {
        throw new Error(`No nodeDB found (id: ${id})`);
      }
      return nodeDB.nodeErrors.get(nodeNum);
    },

    hasNodeError: (nodeNum) => {
      const nodeDB = get().nodeDBs.get(id);
      if (!nodeDB) {
        throw new Error(`No nodeDB found (id: ${id})`);
      }
      return nodeDB.nodeErrors.has(nodeNum);
    },
  };
}

export const nodeDBInitializer: StateCreator<PrivateNodeDBState> = (set, get) => ({
  nodeDBs: new Map(),

  addNodeDB: (id) => {
    const existing = get().nodeDBs.get(id);
    if (existing) {
      // Prune stale nodes when accessing existing nodeDB
      existing.pruneStaleNodes();
      return existing;
    }

    const nodeDB = nodeDBFactory(id, get, set);
    set(
      produce<PrivateNodeDBState>((draft) => {
        draft.nodeDBs = new Map(draft.nodeDBs).set(id, nodeDB);
      }),
    );

    // Prune stale nodes on creation (useful when rehydrating from storage)
    nodeDB.pruneStaleNodes();

    return nodeDB;
  },
  removeNodeDB: (id) => {
    set(
      produce<PrivateNodeDBState>((draft) => {
        const updated = new Map(draft.nodeDBs);
        updated.delete(id);
        draft.nodeDBs = updated;
      }),
    );
  },
  getNodeDBs: () => Array.from(get().nodeDBs.values()),
  getNodeDB: (id) => get().nodeDBs.get(id),
});

const persistOptions: PersistOptions<PrivateNodeDBState, NodeDBPersisted> = {
  name: IDB_KEY_NAME,
  storage: createStorage<NodeDBPersisted>(),
  version: CURRENT_STORE_VERSION,
  partialize: (s): NodeDBPersisted => ({
    // Persist only metadata here; NodeInfo binary blobs are stored separately
    nodeDBs: new Map(
      Array.from(s.nodeDBs.entries()).map(([id, db]) => [
        id,
        {
          id: db.id,
          myNodeNum: db.myNodeNum,
          // don't persist nodeMap here - load it from nodeinfoPersistence on rehydrate
          nodeMap: new Map<number, Protobuf.Mesh.NodeInfo>(),
          nodeErrors: db.nodeErrors,
          // include a small index of node keys to indicate authoritative nodes at persist time
          nodeIndex: Array.from(db.nodeMap.keys()),
        },
      ]),
    ),
  }),
  onRehydrateStorage: () => (state) => {
    if (!state) {
      return;
    }

    (async () => {
      console.debug(
        "NodeDBStore: Rehydrating state with ",
        state.nodeDBs.size,
        " nodeDBs -",
        state.nodeDBs,
      );

      // Build NodeDB instances, and hydrate nodeMap from nodeinfoPersistence
      const rebuilt = new Map<number, NodeDB>();
      for (const [id, data] of (state.nodeDBs as unknown as Map<number, NodeDBData>).entries()) {
        if (data.myNodeNum !== undefined) {
          const dbData: NodeDBData = { ...data };
          try {
            // Backwards compatibility: if the persisted state contains nodeMap entries (older versions),
            // migrate them into the new nodeinfoPersistence store.
            if (data.nodeMap && (data.nodeMap as Map<number, Protobuf.Mesh.NodeInfo>).size > 0) {
              try {
                const nodesFromPersist = Array.from(
                  (data.nodeMap as Map<number, Protobuf.Mesh.NodeInfo>).values(),
                );
                await nodeinfoPersistence.putNodesBatch(id, nodesFromPersist);
                dbData.nodeMap = new Map<number, Protobuf.Mesh.NodeInfo>(
                  nodesFromPersist.map((n) => [n.num, n]),
                );
              } catch (e) {
                console.warn(`NodeDBStore: failed to migrate embedded nodeMap for db ${id}`, e);
                dbData.nodeMap = new Map<number, Protobuf.Mesh.NodeInfo>();
              }
            } else {
              const nodes = await nodeinfoPersistence.getAllNodes(id);
              // If persist-time node index exists, prefer nodes from that index (authoritative)
              if (Array.isArray(dbData.nodeIndex) && dbData.nodeIndex.length > 0) {
                const setIdx = new Set(dbData.nodeIndex);
                const filtered = nodes.filter((n) => setIdx.has(n.num));
                dbData.nodeMap = new Map<number, Protobuf.Mesh.NodeInfo>(
                  filtered.map((n) => [n.num, n]),
                );
              } else {
                dbData.nodeMap = new Map<number, Protobuf.Mesh.NodeInfo>(
                  nodes.map((n) => [n.num, n]),
                );
              }
              // Normalize any positions loaded from persistence (accept strings with commas)
              for (const [num, node] of Array.from(dbData.nodeMap.entries())) {
                if (node.position) {
                  node.position = normalizePosition(node.position);
                  dbData.nodeMap.set(num, node);
                }
              }
            }
          } catch (e) {
            console.warn(`NodeDBStore: failed to load nodeinfo for db ${id}`, e);
            dbData.nodeMap = new Map<number, Protobuf.Mesh.NodeInfo>();
          }

          rebuilt.set(
            id,
            nodeDBFactory(id, useNodeDBStore.getState, useNodeDBStore.setState, dbData),
          );
        }
      }

      useNodeDBStore.setState(
        produce<PrivateNodeDBState>((draft) => {
          draft.nodeDBs = rebuilt;
        }),
      );
    })();
  },
};

// Add persist middleware on the store if the feature flag is enabled
const persistNodes = featureFlags.get("persistNodeDB");
console.debug(`NodeDBStore: Persisting nodes is ${persistNodes ? "enabled" : "disabled"}`);

export const useNodeDBStore = persistNodes
  ? createStore(subscribeWithSelector(persist(nodeDBInitializer, persistOptions)))
  : createStore(subscribeWithSelector(nodeDBInitializer));
