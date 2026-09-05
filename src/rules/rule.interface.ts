export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface RuleFinding {
  ruleId: string;
  message: string;
  file: string;
  line: number;
  severity: Severity;
}

export interface Rule {
  id: string;
  description: string;
  check(filePath: string, content: string): RuleFinding[];
}
