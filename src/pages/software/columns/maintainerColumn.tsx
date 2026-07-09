import type { ColumnsType } from 'antd/es/table';
import MaintainerTag from '../MaintainerTag';
import type { ProjectTableRow } from '../tableRows';

export function createMaintainerColumn(isAscend: boolean): ColumnsType<ProjectTableRow>[number] {
  return {
    title: '维护者',
    dataIndex: 'maintainerName',
    key: 'maintainer',
    width: 120,
    fixed: isAscend ? undefined : 'right' as const,
    render: (_: string, record: ProjectTableRow) => {
      if (record.isVersion) return null;
      return record._project.maintainer
        ? <MaintainerTag maintainer={record._project.maintainer} />
        : <span style={{ color: '#ccc' }}>-</span>;
    },
  };
}
