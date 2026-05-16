export interface UsageVariable {
  variableName: string;
  displayName: string;
  maxValue: number;
  currentCount: number;
  usagePercentage: number;
}

export interface UsageStatusResponse {
  tenantId: string;
  packageName: string;
  variables: UsageVariable[];
}

export interface UsageWarning {
  variableName: string;
  displayName: string;
  currentCount: number;
  maxValue: number;
  percentage: number;
}

export interface UsageWarningsResponse {
  warnings: UsageWarning[];
}
