import type { ColumnsType } from 'antd/es/table';
import type { ProjectTableRow } from './tableRows';
import { createProjectTableRenderers } from './projectTableRenderers';
import { createAscendColumns } from './columns/ascendColumns';
import { createAscendRefreshColumn } from './columns/refreshColumn';
import { createCommonColumns } from './columns/commonColumns';
import { createKunpengColumns } from './columns/kunpengColumns';
import { createMaintainerColumn } from './columns/maintainerColumn';
import type { ProjectColumnsOptions } from './columns/types';

export function createProjectColumns({
  nameColumnWidth,
  projectType,
  visibleExpandedRowKeys,
  onNameColumnResize,
  onRefreshAscendProject,
  projectRefreshing = {},
}: ProjectColumnsOptions): ColumnsType<ProjectTableRow> {
  const isAscend = projectType === '昇腾';
  const validationOverviewVisible = !isAscend;
  const renderers = createProjectTableRenderers({ nameColumnWidth, validationOverviewVisible });

  const columns = [
    ...createCommonColumns({
      isAscend,
      nameColumnWidth,
      validationOverviewVisible,
      onNameColumnResize,
      renderers,
    }),
    ...(isAscend
      ? createAscendColumns({ renderers })
      : createKunpengColumns({ visibleExpandedRowKeys, renderers })),
    createMaintainerColumn(isAscend),
  ];

  if (isAscend && onRefreshAscendProject) {
    columns.push(createAscendRefreshColumn({ onRefreshAscendProject, projectRefreshing }));
  }

  return columns;
}
