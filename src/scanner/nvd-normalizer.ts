import type {
      NvdAttackComplexity,
      NvdAttackVector,
      NvdCisaInformation,
      NvdCvss,
      NvdCvssVersion,
      NvdImpact,
      NvdPrivilegesRequired,
      NvdReference,
      NvdScope,
      NvdSeverity,
      NvdUserInteraction,
      NvdVulnerabilityData,
} from '../rules/rule.interface.js';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null;
const asString = (value: unknown): string | undefined =>
      typeof value === 'string' && value.trim() ? value.trim() : undefined;
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const pickBy = <T>(condition: boolean, whenTrue: T, whenFalse: T): T => (condition ? whenTrue : whenFalse);

const pickEnum = <T extends string>(value: unknown, accepted: readonly T[]): T | undefined => {
      const candidate = asString(value)?.toUpperCase();
      return candidate && accepted.includes(candidate as T) ? (candidate as T) : undefined;
};

const SEVERITIES: NvdSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const ATTACK_VECTORS: NvdAttackVector[] = ['NETWORK', 'ADJACENT', 'LOCAL', 'PHYSICAL'];
const ATTACK_COMPLEXITIES: NvdAttackComplexity[] = ['LOW', 'MEDIUM', 'HIGH'];
const PRIVILEGES: NvdPrivilegesRequired[] = ['NONE', 'LOW', 'HIGH'];
const USER_INTERACTIONS: NvdUserInteraction[] = ['NONE', 'REQUIRED', 'PASSIVE', 'ACTIVE'];
const SCOPES: NvdScope[] = ['UNCHANGED', 'CHANGED'];
const IMPACTS: NvdImpact[] = ['NONE', 'LOW', 'HIGH', 'PARTIAL', 'COMPLETE'];

interface MetricBucket {
      key: string;
      version: NvdCvssVersion;
}

const METRIC_BUCKETS: MetricBucket[] = [
      { key: 'cvssMetricV40', version: '4.0' },
      { key: 'cvssMetricV31', version: '3.1' },
      { key: 'cvssMetricV30', version: '3.0' },
      { key: 'cvssMetricV2', version: '2.0' },
];

const isNvdSource = (metric: UnknownRecord): boolean => asString(metric.source)?.toLowerCase() === 'nvd@nist.gov';
const isPrimaryType = (metric: UnknownRecord): boolean => asString(metric.type) === 'Primary';

const fallbackMetricPriority = (metric: UnknownRecord): number => {
      if (isPrimaryType(metric)) return 1;
      if (isNvdSource(metric)) return 2;
      return 3;
};

const metricPriority = (metric: UnknownRecord): number =>
      isNvdSource(metric) && isPrimaryType(metric) ? 0 : fallbackMetricPriority(metric);

const isValidCvssScore = (score: number, version: NvdCvssVersion): boolean =>
      score >= 0 && score <= 10 && (score !== 0 || version === '2.0');

const classifyHighOrCritical = (score: number, version: NvdCvssVersion): NvdSeverity =>
      version === '2.0' || score < 9 ? 'HIGH' : 'CRITICAL';

const classifySeverity = (score: number, version: NvdCvssVersion): NvdSeverity => {
      if (score < 4) return 'LOW';
      if (score < 7) return 'MEDIUM';
      return classifyHighOrCritical(score, version);
};

const deriveSeverity = (score: number, version: NvdCvssVersion): NvdSeverity | undefined =>
      isValidCvssScore(score, version) ? classifySeverity(score, version) : undefined;

const normalizeAttackVector = (value: unknown): NvdAttackVector | undefined => {
      const normalized = asString(value)?.toUpperCase();
      return pickEnum(normalized === 'ADJACENT_NETWORK' ? 'ADJACENT' : normalized, ATTACK_VECTORS);
};

const validatedCvssData = (
      metric: UnknownRecord,
      version: NvdCvssVersion,
): { data: UnknownRecord; vectorString: string; score: number } | undefined => {
      if (!isRecord(metric.cvssData)) return undefined;
      const data = metric.cvssData;
      const dataVersion = asString(data.version);
      const vectorString = asString(data.vectorString);
      const score = data.baseScore;
      const scoreIsValidNumber = typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 10;
      if (dataVersion !== version || !vectorString || !scoreIsValidNumber) return undefined;
      return { data, vectorString, score };
};

const metricSeverity = (
      metric: UnknownRecord,
      data: UnknownRecord,
      score: number,
      version: NvdCvssVersion,
): NvdSeverity | undefined => {
      const wrapperSeverity = pickBy(version === '2.0', metric.baseSeverity, data.baseSeverity);
      const rawSeverity = asString(wrapperSeverity);
      return rawSeverity === undefined ? deriveSeverity(score, version) : pickEnum(rawSeverity, SEVERITIES);
};

const metricUserInteraction = (
      metric: UnknownRecord,
      data: UnknownRecord,
      version: NvdCvssVersion,
): NvdUserInteraction | undefined => {
      if (version === '2.0' && typeof metric.userInteractionRequired === 'boolean') {
            return metric.userInteractionRequired ? 'REQUIRED' : 'NONE';
      }
      return pickEnum(data.userInteraction, USER_INTERACTIONS);
};

const metricType = (rawType: string | undefined): 'Primary' | 'Secondary' | undefined =>
      rawType === 'Primary' || rawType === 'Secondary' ? rawType : undefined;

const privilegesRequiredValue = (data: UnknownRecord, version: NvdCvssVersion): NvdPrivilegesRequired | undefined =>
      version === '2.0' ? undefined : pickEnum(data.privilegesRequired, PRIVILEGES);

const scopeValue = (data: UnknownRecord, version: NvdCvssVersion): NvdScope | undefined =>
      version === '4.0' || version === '2.0' ? undefined : pickEnum(data.scope, SCOPES);

interface RawMetricFields {
      severity?: NvdSeverity;
      source?: string;
      type?: 'Primary' | 'Secondary';
      attackVector?: NvdAttackVector;
      attackComplexity?: NvdAttackComplexity;
      privilegesRequired?: NvdPrivilegesRequired;
      userInteraction?: NvdUserInteraction;
      scope?: NvdScope;
      confidentialityImpact?: NvdImpact;
      integrityImpact?: NvdImpact;
      availabilityImpact?: NvdImpact;
}

const computeMetricFields = (
      metric: UnknownRecord,
      data: UnknownRecord,
      score: number,
      version: NvdCvssVersion,
): RawMetricFields => ({
      severity: metricSeverity(metric, data, score, version),
      source: asString(metric.source),
      type: metricType(asString(metric.type)),
      attackVector: normalizeAttackVector(pickBy(version === '2.0', data.accessVector, data.attackVector)),
      attackComplexity: pickEnum(
            pickBy(version === '2.0', data.accessComplexity, data.attackComplexity),
            ATTACK_COMPLEXITIES,
      ),
      privilegesRequired: privilegesRequiredValue(data, version),
      userInteraction: metricUserInteraction(metric, data, version),
      scope: scopeValue(data, version),
      confidentialityImpact: pickEnum(
            pickBy(version === '4.0', data.vulnConfidentialityImpact, data.confidentialityImpact),
            IMPACTS,
      ),
      integrityImpact: pickEnum(pickBy(version === '4.0', data.vulnIntegrityImpact, data.integrityImpact), IMPACTS),
      availabilityImpact: pickEnum(
            pickBy(version === '4.0', data.vulnAvailabilityImpact, data.availabilityImpact),
            IMPACTS,
      ),
});

const withOptionalFields = (
      base: { score: number; version: NvdCvssVersion; vectorString: string },
      fields: RawMetricFields,
): NvdCvss => ({
      ...base,
      ...(fields.severity && { severity: fields.severity }),
      ...(fields.source && { source: fields.source }),
      ...(fields.type && { type: fields.type }),
      ...(fields.attackVector && { attackVector: fields.attackVector }),
      ...(fields.attackComplexity && { attackComplexity: fields.attackComplexity }),
      ...(fields.privilegesRequired && { privilegesRequired: fields.privilegesRequired }),
      ...(fields.userInteraction && { userInteraction: fields.userInteraction }),
      ...(fields.scope && { scope: fields.scope }),
      ...(fields.confidentialityImpact && { confidentialityImpact: fields.confidentialityImpact }),
      ...(fields.integrityImpact && { integrityImpact: fields.integrityImpact }),
      ...(fields.availabilityImpact && { availabilityImpact: fields.availabilityImpact }),
});

const normalizeMetric = (metric: UnknownRecord, version: NvdCvssVersion): NvdCvss | undefined => {
      const validated = validatedCvssData(metric, version);
      if (!validated) return undefined;
      const { data, vectorString, score } = validated;
      const fields = computeMetricFields(metric, data, score, version);
      return withOptionalFields({ score, version, vectorString }, fields);
};

const rankedCandidates = (metrics: UnknownRecord, key: string): UnknownRecord[] =>
      // codesentry-disable-next-line security/detect-object-injection -- key always comes from the hardcoded METRIC_BUCKETS list, never attacker input.
      asArray(metrics[key])
            .filter(isRecord)
            .map((metric, index) => ({ metric, index, priority: metricPriority(metric) }))
            .sort((a, b) => a.priority - b.priority || a.index - b.index)
            .map(({ metric }) => metric);

const firstNormalizedCandidate = (candidates: UnknownRecord[], version: NvdCvssVersion): NvdCvss | undefined => {
      for (const metric of candidates) {
            const normalized = normalizeMetric(metric, version);
            if (normalized) return normalized;
      }
      return undefined;
};

const selectCvss = (metrics: unknown): NvdCvss | undefined => {
      if (!isRecord(metrics)) return undefined;
      for (const bucket of METRIC_BUCKETS) {
            const normalized = firstNormalizedCandidate(rankedCandidates(metrics, bucket.key), bucket.version);
            if (normalized) return normalized;
      }
      return undefined;
};

const selectDescription = (descriptions: unknown): { description?: string; descriptionLanguage?: string } => {
      const candidates = asArray(descriptions).filter(isRecord);
      const selected =
            candidates.find((item) => asString(item.lang)?.toLowerCase() === 'en') ??
            candidates.find((item) => asString(item.lang)?.toLowerCase().startsWith('en-')) ??
            candidates[0];
      if (!selected) return {};
      return { description: asString(selected.value), descriptionLanguage: asString(selected.lang) };
};

const normalizeCwes = (weaknesses: unknown): string[] => {
      const values = asArray(weaknesses)
            .filter(isRecord)
            .flatMap((weakness) => asArray(weakness.description))
            .filter(isRecord)
            .map((description) => asString(description.value)?.toUpperCase())
            .filter((value): value is string => value !== undefined && /^CWE-\d+$/.test(value));
      return [...new Set(values)];
};

const normalizeReferences = (references: unknown): NvdReference[] => {
      const deduped = new Map<string, NvdReference>();
      for (const reference of asArray(references).filter(isRecord)) {
            const url = asString(reference.url);
            if (!url || deduped.has(url)) continue;
            deduped.set(url, {
                  url,
                  source: asString(reference.source),
                  tags: asArray(reference.tags)
                        .map(asString)
                        .filter((tag): tag is string => tag !== undefined),
            });
      }
      return [...deduped.values()];
};

const ssvcOption = (options: unknown, key: string): string | undefined => {
      for (const option of asArray(options).filter(isRecord)) {
            // codesentry-disable-next-line security/detect-object-injection -- key is always a hardcoded literal from call sites below, never attacker input.
            const value = asString(option[key]);
            if (value) return value;
      }
      return undefined;
};

const normalizeKev = (cve: UnknownRecord): NvdCisaInformation['kev'] => {
      const addedAt = asString(cve.cisaExploitAdd);
      return addedAt
            ? {
                    addedAt,
                    actionDue: asString(cve.cisaActionDue),
                    requiredAction: asString(cve.cisaRequiredAction),
                    vulnerabilityName: asString(cve.cisaVulnerabilityName),
              }
            : undefined;
};

const findSsvcMetric = (cve: UnknownRecord): UnknownRecord | undefined => {
      const metrics = isRecord(cve.metrics) ? cve.metrics : undefined;
      return asArray(metrics?.ssvcV203)
            .filter(isRecord)
            .map((entry) => entry.ssvcData)
            .find((data): data is UnknownRecord => isRecord(data) && asString(data.role) === 'CISA Coordinator');
};

const normalizeSsvc = (ssvcMetric: UnknownRecord | undefined): NvdCisaInformation['ssvc'] =>
      ssvcMetric
            ? {
                    exploitation: ssvcOption(ssvcMetric.options, 'exploitation'),
                    automatable: ssvcOption(ssvcMetric.options, 'automatable'),
                    technicalImpact: ssvcOption(ssvcMetric.options, 'technicalImpact'),
                    timestamp: asString(ssvcMetric.timestamp),
              }
            : undefined;

const normalizeCisa = (cve: UnknownRecord): NvdCisaInformation | undefined => {
      const kev = normalizeKev(cve);
      const ssvc = normalizeSsvc(findSsvcMetric(cve));
      return kev || ssvc ? { kev, ssvc } : undefined;
};

export const normalizeNvdCve = (value: unknown, expectedCveId: string): NvdVulnerabilityData | undefined => {
      if (!isRecord(value)) return undefined;
      const id = asString(value.id)?.toUpperCase();
      if (!id || id !== expectedCveId.toUpperCase()) return undefined;
      return {
            id,
            vulnerabilityStatus: asString(value.vulnStatus),
            ...selectDescription(value.descriptions),
            published: asString(value.published),
            lastModified: asString(value.lastModified),
            cvss: selectCvss(value.metrics),
            cwes: normalizeCwes(value.weaknesses),
            references: normalizeReferences(value.references),
            cisa: normalizeCisa(value),
      };
};
