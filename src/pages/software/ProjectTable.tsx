import { useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Table } from 'antd';
import type { TablePaginationConfig } from 'antd/es/table';
import { Project, ProjectType } from '../../domain/projectTypes';
import type { ProjectRefreshScope } from '../../domain/projectTypes';
import { buildProjectRows, type ProjectTableRow } from './tableRows';
import { createProjectColumns } from './projectTableColumns';

const defaultNameColumnWidth = 280;
const minNameColumnWidth = 180;
const maxNameColumnWidth = 560;

interface ProjectTableProps {
  projects: Project[];
  projectType: ProjectType;
  pagination?: false | TablePaginationConfig;
  expandAllRows?: boolean;
  loading?: boolean;
  onRefreshAscendProject?: (name: string, scope: ProjectRefreshScope) => Promise<void> | void;
  projectRefreshing?: Record<string, boolean>;
}

export default function ProjectTable({
  projects,
  projectType,
  pagination = {
    defaultPageSize: 50,
    showSizeChanger: { placement: 'topRight', getPopupContainer: () => document.body },
    pageSizeOptions: [10, 20, 50, 100],
    showTotal: total => `共 ${total} 个项目`,
  },
  expandAllRows = false,
  loading = false,
  onRefreshAscendProject,
  projectRefreshing = {},
}: ProjectTableProps) {
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [nameColumnWidth, setNameColumnWidth] = useState(defaultNameColumnWidth);
  const isAscend = projectType === '昇腾';

  const treeData = useMemo(() => buildProjectRows(projects, projectType), [projects, projectType]);
  const expandableRowKeys = useMemo(
    () => treeData.filter(row => row.children?.length).map(row => row.key),
    [treeData],
  );
  const visibleExpandedRowKeys = expandedRowKeys.filter(key => expandableRowKeys.includes(key));

  useEffect(() => {
    setExpandedRowKeys(expandAllRows ? expandableRowKeys : []);
  }, [expandAllRows, expandableRowKeys]);

  const startNameColumnResize = (event: ReactMouseEvent<HTMLSpanElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = nameColumnWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextWidth = startWidth + moveEvent.clientX - startX;
      setNameColumnWidth(Math.min(maxNameColumnWidth, Math.max(minNameColumnWidth, nextWidth)));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const columns = createProjectColumns({
    nameColumnWidth,
    projectType,
    visibleExpandedRowKeys,
    onNameColumnResize: startNameColumnResize,
    onRefreshAscendProject,
    projectRefreshing,
  });

  const scrollWidth = columns.reduce((total, column) => (
    total + (typeof column.width === 'number' ? column.width : 120)
  ), 0);
  const scrollX = Math.max(scrollWidth, 900);
  const tableScroll = isAscend ? { y: 'calc(100vh - 318px)' } : { x: scrollX, y: 'calc(100vh - 318px)' };

  return (
    <Table
      className="project-table"
      columns={columns}
      dataSource={treeData}
      rowKey="key"
      loading={loading}
      scroll={tableScroll}
      pagination={pagination}
      size="middle"
      expandable={{
        expandedRowKeys: visibleExpandedRowKeys,
        onExpandedRowsChange: keys => setExpandedRowKeys(keys.map(String)),
        defaultExpandAllRows: false,
        indentSize: 0,
      }}
      rowClassName={(record: ProjectTableRow) => {
        const isExpandedParent = !record.isVersion && visibleExpandedRowKeys.includes(record.key);
        const isLastVersion = record.isVersion && record.versionIndex === record._project.supportedVersions.length - 1;
        return [
          'project-card-row',
          record.groupIndex % 2 === 0 ? 'project-group-even' : 'project-group-odd',
          record.isVersion ? 'version-sub-row project-card-child' : 'project-main-row',
          isExpandedParent ? 'project-card-start' : '',
          !record.isVersion && !isExpandedParent ? 'project-card-single' : '',
          record.isVersion && isLastVersion ? 'project-card-end' : '',
          record.isVersion && !isLastVersion ? 'project-card-middle' : '',
        ].filter(Boolean).join(' ');
      }}
      onRow={(record) => {
        if (record.isVersion) return {};
        return { style: { cursor: 'pointer' } };
      }}
    />
  );
}
