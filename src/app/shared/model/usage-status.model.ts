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
