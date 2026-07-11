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
  isBillable: boolean;
  planTimeline: PlanTimeline | null;
  variables: UsageVariable[];
}

export interface PlanTimeline {
  startDate: string;
  endDate: string;
  totalDays: number;
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
