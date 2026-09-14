export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type NvdSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type NvdCvssVersion = '4.0' | '3.1' | '3.0' | '2.0';
export type NvdAttackVector = 'NETWORK' | 'ADJACENT' | 'LOCAL' | 'PHYSICAL';
export type NvdAttackComplexity = 'LOW' | 'MEDIUM' | 'HIGH';
export type NvdPrivilegesRequired = 'NONE' | 'LOW' | 'HIGH';
export type NvdUserInteraction = 'NONE' | 'REQUIRED' | 'PASSIVE' | 'ACTIVE';
export type NvdScope = 'UNCHANGED' | 'CHANGED';
export type NvdImpact = 'NONE' | 'LOW' | 'HIGH' | 'PARTIAL' | 'COMPLETE';

export interface NvdCvss {
      score: number;
      severity?: NvdSeverity;
      version: NvdCvssVersion;
      vectorString: string;
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

export interface NvdReference {
      url: string;
      source?: string;
      tags: string[];
}

export interface NvdCisaInformation {
      kev?: {
            addedAt: string;
            actionDue?: string;
            requiredAction?: string;
            vulnerabilityName?: string;
      };
      ssvc?: {
            exploitation?: string;
            automatable?: string;
            technicalImpact?: string;
            timestamp?: string;
      };
}

export interface NvdVulnerabilityData {
      id: string;
      vulnerabilityStatus?: string;
      description?: string;
      descriptionLanguage?: string;
      published?: string;
      lastModified?: string;
      cvss?: NvdCvss;
      cwes: string[];
      references: NvdReference[];
      cisa?: NvdCisaInformation;
}

export type NvdErrorKind =
      'forbidden' | 'rate-limit' | 'timeout' | 'server' | 'network' | 'invalid-response' | 'unavailable' | 'http';

export type NvdLookupResult =
      | { status: 'found'; cveId: string; data: NvdVulnerabilityData; fromCache?: boolean }
      | { status: 'not-found'; cveId: string; fromCache?: boolean }
      | { status: 'error'; cveId: string; error: { kind: NvdErrorKind; httpStatus?: number } };

export interface DependencyFindingDetails {
      package: {
            name: string;
            installedVersion: string;
            fixedVersions: string[];
            /** Package ecosystem (e.g. "npm", "PyPI") — absent for npm-audit findings, which are always npm. */
            ecosystem?: string;
      };
      advisory: {
            source: 'osv' | 'npm';
            id?: string;
            aliases: string[];
            summary?: string;
      };
      nvd?: NvdLookupResult[];
}

export interface RuleFinding {
      ruleId: string;
      message: string;
      file: string;
      line: number;
      severity: Severity;
      dependency?: DependencyFindingDetails;
}

export interface Rule {
      id: string;
      description: string;
      check(filePath: string, content: string): RuleFinding[];
}
