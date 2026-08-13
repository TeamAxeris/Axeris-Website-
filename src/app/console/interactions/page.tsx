"use client";

import { useEffect, useState, useMemo } from "react";
import { getInteractionNetwork, getPatients } from "@/lib/api";
import type { InteractionNetwork, InteractionEdge, InteractionNode, Patient } from "@/types";
import Header from "@/components/layout/Header";
import clsx from "clsx";
import { AlertCircle, AlertTriangle, Info, Zap, Search } from "lucide-react";

const severityColors: Record<string, { bg: string; border: string; text: string; line: string }> = {
  major: { bg: "bg-red-50 dark:bg-red-900/20", border: "border-red-300", text: "text-red-700 dark:text-red-300", line: "#ef4444" },
  moderate: { bg: "bg-yellow-50 dark:bg-yellow-900/20", border: "border-yellow-300", text: "text-yellow-700 dark:text-yellow-300", line: "#eab308" },
  minor: { bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-300", text: "text-blue-700 dark:text-blue-300", line: "#3b82f6" },
};

const severityIcons = {
  major: AlertCircle,
  moderate: AlertTriangle,
  minor: Info,
};

export default function InteractionsPage() {
  const [network, setNetwork] = useState<InteractionNetwork | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [selectedEdge, setSelectedEdge] = useState<InteractionEdge | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPatients().then(setPatients).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    getInteractionNetwork(selectedPatient || undefined)
      .then(setNetwork)
      .finally(() => setLoading(false));
  }, [selectedPatient]);

  // Filter edges by severity
  const filteredEdges = useMemo(() => {
    if (!network) return [];
    if (filterSeverity === "all") return network.edges;
    return network.edges.filter((e) => e.severity === filterSeverity);
  }, [network, filterSeverity]);

  // Get connected nodes for filtered edges
  const connectedNodeIds = useMemo(() => {
    const ids = new Set<string>();
    filteredEdges.forEach((e) => {
      ids.add(e.source);
      ids.add(e.target);
    });
    return ids;
  }, [filteredEdges]);

  const filteredNodes = useMemo(() => {
    if (!network) return [];
    return network.nodes.filter((n) => connectedNodeIds.has(n.id));
  }, [network, connectedNodeIds]);

  // Highlight connections for hovered node
  const hoveredConnections = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const set = new Set<string>();
    filteredEdges.forEach((e) => {
      if (e.source === hoveredNode || e.target === hoveredNode) {
        set.add(e.source);
        set.add(e.target);
      }
    });
    return set;
  }, [hoveredNode, filteredEdges]);

  // Severity counts
  const severityCounts = useMemo(() => {
    if (!network) return { major: 0, moderate: 0, minor: 0 };
    return {
      major: network.edges.filter((e) => e.severity === "major").length,
      moderate: network.edges.filter((e) => e.severity === "moderate").length,
      minor: network.edges.filter((e) => e.severity === "minor").length,
    };
  }, [network]);

  // Group nodes by category for visualization
  const categoryGroups = useMemo(() => {
    const groups: Record<string, InteractionNode[]> = {};
    filteredNodes.forEach((n) => {
      const cat = n.category || "other";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(n);
    });
    return groups;
  }, [filteredNodes]);

  return (
    <>
      <Header title="Drug Interaction Network" />
      <div className="mt-4 space-y-6">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-gray-500 block mb-1">Filter by Patient</label>
            <select
              value={selectedPatient}
              onChange={(e) => { setSelectedPatient(e.target.value); setSelectedEdge(null); }}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600"
            >
              <option value="">All Drugs (Global Network)</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.first_name} {p.last_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Filter by Severity</label>
            <div className="flex gap-1 bg-white rounded-lg border border-gray-200 p-1 dark:bg-slate-800 dark:border-slate-700">
              {["all", "major", "moderate", "minor"].map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterSeverity(s)}
                  className={clsx(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors capitalize",
                    filterSeverity === s ? "bg-slate-900 text-white" : "text-gray-600 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700/40"
                  )}
                >
                  {s === "all" ? "All" : s} {s !== "all" && `(${severityCounts[s as keyof typeof severityCounts]})`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 dark:bg-slate-800 dark:border-slate-700">
            <div className="p-2 bg-purple-50 rounded-lg dark:bg-purple-900/20">
              <Zap className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{filteredEdges.length}</div>
              <div className="text-xs text-gray-500">Interactions Shown</div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 dark:bg-slate-800 dark:border-slate-700">
            <div className="p-2 bg-red-50 rounded-lg dark:bg-red-900/20">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{severityCounts.major}</div>
              <div className="text-xs text-gray-500">Major Interactions</div>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 dark:bg-slate-800 dark:border-slate-700">
            <div className="p-2 bg-blue-50 rounded-lg dark:bg-blue-900/20">
              <Search className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{filteredNodes.length}</div>
              <div className="text-xs text-gray-500">Drugs Involved</div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-400">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-purple-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading interaction network...</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Drug Nodes Grid */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 dark:bg-slate-800 dark:border-slate-700">
              <h3 className="text-sm font-semibold text-gray-700 mb-4 dark:text-slate-300">Drug Interaction Map</h3>
              {Object.keys(categoryGroups).length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  No interactions found{selectedPatient ? " for this patient" : ""}
                </div>
              ) : (
                <div className="space-y-6">
                  {Object.entries(categoryGroups).map(([category, nodes]) => (
                    <div key={category}>
                      <div className="text-xs font-semibold text-gray-400 uppercase mb-2">{category}</div>
                      <div className="flex flex-wrap gap-2">
                        {nodes.map((node) => {
                          const isHovered = hoveredNode === node.id;
                          const isConnected = hoveredNode ? hoveredConnections.has(node.id) : false;
                          const isPatientDrug = node.is_patient_drug;
                          const dimmed = hoveredNode && !isConnected && !isHovered;

                          return (
                            <button
                              key={node.id}
                              onMouseEnter={() => setHoveredNode(node.id)}
                              onMouseLeave={() => setHoveredNode(null)}
                              onClick={() => {
                                // Find interactions involving this drug
                                const edges = filteredEdges.filter(
                                  (e) => e.source === node.id || e.target === node.id
                                );
                                if (edges.length > 0) setSelectedEdge(edges[0]);
                              }}
                              className={clsx(
                                "px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 border-2",
                                isHovered && "ring-2 ring-purple-400 scale-105 shadow-lg",
                                isConnected && !isHovered && "ring-1 ring-purple-200 scale-102",
                                dimmed && "opacity-30",
                                isPatientDrug
                                  ? "bg-blue-50 border-blue-300 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                                  : "bg-gray-50 border-gray-200 text-gray-700 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-700",
                              )}
                            >
                              <span>{node.label}</span>
                              {node.brand && (
                                <span className="text-xs opacity-60 ml-1">({node.brand})</span>
                              )}
                              {node.schedule && node.schedule !== "none" && (
                                <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded ml-2 dark:text-orange-300 dark:bg-orange-900/30">
                                  Sch. {node.schedule}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Interaction Lines List */}
              <div className="mt-6 border-t border-gray-100 pt-4 dark:border-slate-700">
                <h4 className="text-xs font-semibold text-gray-400 uppercase mb-3">Interaction Pairs</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {filteredEdges.map((edge, i) => {
                    const colors = severityColors[edge.severity] || severityColors.minor;
                    const Icon = severityIcons[edge.severity as keyof typeof severityIcons] || Info;
                    const sourceNode = filteredNodes.find((n) => n.id === edge.source);
                    const targetNode = filteredNodes.find((n) => n.id === edge.target);

                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedEdge(edge)}
                        className={clsx(
                          "w-full flex items-center gap-3 p-3 rounded-lg border transition-all hover:shadow-md text-left",
                          selectedEdge === edge ? `${colors.bg} ${colors.border} shadow-md` : "border-gray-100 hover:border-gray-200 dark:border-slate-700",
                        )}
                      >
                        <Icon className={clsx("w-4 h-4 flex-shrink-0", colors.text)} />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {sourceNode?.label || edge.source}
                          </span>
                          <span className="text-gray-400 mx-2">+</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {targetNode?.label || edge.target}
                          </span>
                        </div>
                        <span className={clsx(
                          "text-xs font-medium px-2 py-0.5 rounded capitalize",
                          colors.bg, colors.text
                        )}>
                          {edge.severity}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Detail Panel */}
            <div className="space-y-4">
              {selectedEdge ? (
                <div className={clsx(
                  "bg-white rounded-xl border-2 p-5 animate-fade-in dark:bg-slate-800",
                  severityColors[selectedEdge.severity]?.border || "border-gray-200 dark:border-slate-700"
                )}>
                  <div className="flex items-center gap-2 mb-4">
                    {(() => {
                      const Icon = severityIcons[selectedEdge.severity as keyof typeof severityIcons] || Info;
                      const colors = severityColors[selectedEdge.severity] || severityColors.minor;
                      return <Icon className={clsx("w-5 h-5", colors.text)} />;
                    })()}
                    <h3 className="font-semibold text-gray-900 dark:text-white">Interaction Details</h3>
                    <span className={clsx(
                      "text-xs font-medium px-2 py-0.5 rounded capitalize ml-auto",
                      severityColors[selectedEdge.severity]?.bg,
                      severityColors[selectedEdge.severity]?.text,
                    )}>
                      {selectedEdge.severity}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Drug Pair</div>
                      <div className="text-sm text-gray-900 dark:text-white">
                        {filteredNodes.find((n) => n.id === selectedEdge.source)?.label || selectedEdge.source}
                        {" + "}
                        {filteredNodes.find((n) => n.id === selectedEdge.target)?.label || selectedEdge.target}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Description</div>
                      <div className="text-sm text-gray-700 dark:text-slate-300">{selectedEdge.description}</div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Clinical Effect</div>
                      <div className="text-sm text-gray-700 dark:text-slate-300">{selectedEdge.clinical_effect}</div>
                    </div>

                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Management</div>
                      <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 dark:bg-slate-900/40 dark:text-slate-300">{selectedEdge.management}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center dark:bg-slate-800 dark:border-slate-700">
                  <Zap className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                  <div className="text-sm text-gray-500">Select an interaction pair to view details</div>
                </div>
              )}

              {/* Legend */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 dark:bg-slate-800 dark:border-slate-700">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 dark:text-slate-300">Legend</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-xs text-gray-600 dark:text-slate-400">Major · avoid combination, high risk</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="text-xs text-gray-600 dark:text-slate-400">Moderate · use with caution, monitor</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-xs text-gray-600 dark:text-slate-400">Minor · minimal clinical significance</span>
                  </div>
                  <hr className="my-2" />
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-blue-50 border border-blue-300 text-xs text-blue-800 dark:bg-blue-900/20 dark:text-blue-300">Drug</span>
                    <span className="text-xs text-gray-600 dark:text-slate-400">Patient&apos;s active medication</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-gray-50 border border-gray-200 text-xs text-gray-700 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-700">Drug</span>
                    <span className="text-xs text-gray-600 dark:text-slate-400">Other drug in database</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
