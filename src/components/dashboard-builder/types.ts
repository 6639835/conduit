export type WidgetType = 'metric' | 'line-chart' | 'bar-chart' | 'donut-chart' | 'table';

export interface WidgetPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WidgetConfig {
  dataSource: string;
  refreshInterval?: number;
  filters?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  config: WidgetConfig;
  position: WidgetPosition;
}

export interface DashboardLayout {
  cols: number;
  rowHeight: number;
  [key: string]: unknown;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string | null;
  layout: DashboardLayout;
  widgets: Widget[];
  visibility: 'private' | 'organization' | 'public';
  organizationId?: string | null;
  shareToken?: string | null;
  shareExpiresAt?: Date | null;
  isDefault: boolean;
  refreshInterval: number;
  theme: 'light' | 'dark' | 'auto';
  createdBy: string;
  lastViewedAt?: Date | null;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}
