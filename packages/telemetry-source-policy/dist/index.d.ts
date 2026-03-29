export declare const TELEMETRY_SOURCE_POLICY_VERSION = "2026-03-29";
export type PublisherRole = 'primary' | 'shadow';
export type SignalKSourceFamily = 'defaults' | 'engine_hours_plugin' | 'leopard_plugin' | 'nmea0183' | 'nmea2000' | 'plugin' | 'signalk_server' | 'speed_wind_plugin' | 'unknown' | 'venus';
export type DuplicateDropReason = 'debug_only_path' | 'lower_priority_source' | 'shadow_source_suppressed' | 'sticky_winner_retained';
export type SignalKUpdateSource = {
    label?: string;
    pgn?: number;
    sentence?: string;
    src?: string;
    talker?: string;
    type?: string;
    [key: string]: unknown;
};
export type TelemetryValue = {
    path: string;
    value: unknown;
};
export type SourceAwareTelemetryUpdate = {
    $source?: string;
    dropReason?: DuplicateDropReason;
    receivedAt?: string;
    source?: SignalKUpdateSource | null;
    timestamp?: string;
    values: TelemetryValue[];
};
export type SourceAwareTelemetryDelta = {
    context?: string;
    publisherRole?: PublisherRole;
    self?: string;
    updates: SourceAwareTelemetryUpdate[];
};
export type TelemetrySourceCandidate = {
    canonicalPath: string;
    context: string;
    groupKey: string;
    observedAt?: string;
    originalPath: string;
    publisherRole: PublisherRole;
    receivedAt: string;
    self: string;
    source?: SignalKUpdateSource | null;
    sourceFamily: SignalKSourceFamily;
    sourceId: string;
    updateTimestamp?: string;
    value: unknown;
};
export type TelemetrySelectionDrop = {
    candidate: TelemetrySourceCandidate;
    reason: DuplicateDropReason;
};
export type TelemetrySelectionResult = {
    debugOnly: boolean;
    dropped: TelemetrySelectionDrop[];
    fallbackToLowerPriority: boolean;
    key: string;
    shadowSourceSuppressed: boolean;
    winner: TelemetrySourceCandidate | null;
};
export type TelemetryStickyWinner = {
    precedenceRank?: number;
    publisherRole: PublisherRole;
    receivedAt: string;
    sourceId: string;
};
export type NormalizedSourceInventoryEntry = {
    family: SignalKSourceFamily;
    label: string;
    metadata: Record<string, boolean | number | string | null>;
    sourceId: string;
};
export type SourceInventorySnapshot = {
    observedAt: string;
    publisherRole: PublisherRole;
    selfContext: string | null;
    sourceCount: number;
    sources: NormalizedSourceInventoryEntry[];
};
export declare function classifySignalKSourceFamily(sourceId: string): "defaults" | "engine_hours_plugin" | "leopard_plugin" | "nmea0183" | "nmea2000" | "plugin" | "signalk_server" | "speed_wind_plugin" | "unknown" | "venus";
export declare function expandTelemetryValueLeaves(input: TelemetryValue): {
    canonicalPath: string;
    originalPath: string;
    value: unknown;
}[];
export declare function expandSignalKLeafValues(path: string, value: unknown): {
    canonicalPath: string;
    value: unknown;
}[];
export declare function expandDeltaToSourceCandidates(input: {
    delta: SourceAwareTelemetryDelta;
    publisherRole?: PublisherRole;
}): TelemetrySourceCandidate[];
export declare function selectCanonicalTelemetry(input: {
    candidates: TelemetrySourceCandidate[];
    now?: number;
    stickyWinners?: Map<string, TelemetryStickyWinner> | Record<string, TelemetryStickyWinner>;
}): TelemetrySelectionResult[];
type CompatibleSelectionResult = {
    canonicalPath: string;
    kept?: TelemetrySourceCandidate | null;
    rejected?: Array<{
        candidate: TelemetrySourceCandidate;
        reason: DuplicateDropReason | 'sticky_winner_fresh';
        sourceId: string;
    }>;
    winnerPublisherRole?: PublisherRole | null;
    winnerSourceId?: string | null;
};
export declare function buildStickyWinnerMap(results: Array<TelemetrySelectionResult | CompatibleSelectionResult>): Map<string, TelemetryStickyWinner>;
export declare function createTelemetrySourceCandidates(input: {
    context: string;
    observedAt?: string;
    originalPath: string;
    publisherRole: PublisherRole;
    receivedAt: string;
    self?: string;
    source?: SignalKUpdateSource | null;
    sourceId: string;
    timestamp?: string;
    value: unknown;
}): TelemetrySourceCandidate[];
export declare function buildDeltaFromCandidates(input: {
    candidates: TelemetrySourceCandidate[];
    context?: string;
    dropReason?: DuplicateDropReason;
    publisherRole?: PublisherRole;
    self?: string;
}): {
    updates: SourceAwareTelemetryUpdate[];
    self?: string | undefined;
    publisherRole?: PublisherRole | undefined;
    context?: string | undefined;
} | null;
export declare function normalizeSourceInventorySnapshot(input: {
    observedAt?: string;
    publisherRole?: PublisherRole;
    selfContext?: string | null;
    sources: unknown;
}): {
    observedAt: string;
    publisherRole: PublisherRole;
    selfContext: string | null;
    sourceCount: number;
    sources: {
        family: "defaults" | "engine_hours_plugin" | "leopard_plugin" | "nmea0183" | "nmea2000" | "plugin" | "signalk_server" | "speed_wind_plugin" | "unknown" | "venus";
        label: string;
        metadata: Record<string, string | number | boolean | null>;
        sourceId: string;
    }[];
};
export declare function normalizeSignalKSourceInventory(input: {
    observedAt?: string;
    publisherRole?: PublisherRole;
    selfContext?: string | null;
    raw: unknown;
}): {
    observedAt: string;
    publisherRole: PublisherRole;
    selfContext: string | null;
    sourceCount: number;
    sources: {
        family: "defaults" | "engine_hours_plugin" | "leopard_plugin" | "nmea0183" | "nmea2000" | "plugin" | "signalk_server" | "speed_wind_plugin" | "unknown" | "venus";
        label: string;
        metadata: Record<string, string | number | boolean | null>;
        sourceId: string;
    }[];
};
export declare function normalizeTelemetryPathFamily(path: string): string;
export declare function getSelectionPolicySummary(results: TelemetrySelectionResult[]): {
    fallbackToLowerPriority: number;
    losersDropped: number;
    winnersKept: number;
    shadowSourceSuppressed: number;
};
export declare function selectTelemetryCandidates(input: {
    candidates: TelemetrySourceCandidate[];
    now?: number | string;
    stickyWinners?: Map<string, TelemetryStickyWinner> | Record<string, TelemetryStickyWinner>;
}): {
    canonicalPath: string;
    debugOnly: boolean;
    dropped: TelemetrySelectionDrop[];
    fallbackToLowerPriority: boolean;
    kept: TelemetrySourceCandidate | null;
    key: string;
    rejected: {
        candidate: TelemetrySourceCandidate;
        reason: DuplicateDropReason | "sticky_winner_fresh";
        sourceId: string;
    }[];
    shadowSourceSuppressed: boolean;
    winner: TelemetrySourceCandidate | null;
    winnerPublisherRole: PublisherRole | null;
    winnerSourceId: string | null;
}[];
export {};
