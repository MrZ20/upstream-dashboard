import type { MouseEvent as ReactMouseEvent } from 'react';
import type { ProjectRefreshScope } from '../../../domain/projectTypes';
import type { ProjectType } from '../../../domain/projectTypes';
import type { createProjectTableRenderers } from '../projectTableRenderers';

export interface ProjectColumnsOptions {
  nameColumnWidth: number;
  projectType: ProjectType;
  visibleExpandedRowKeys: string[];
  onNameColumnResize: (event: ReactMouseEvent<HTMLSpanElement>) => void;
  onRefreshAscendProject?: (name: string, scope: ProjectRefreshScope) => Promise<void> | void;
  projectRefreshing?: Record<string, boolean>;
}

export type ProjectTableRenderers = ReturnType<typeof createProjectTableRenderers>;
