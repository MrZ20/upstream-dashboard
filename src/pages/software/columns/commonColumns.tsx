import { Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { ProjectTableRow } from '../tableRows';
import type { ProjectTableRenderers } from './types';

interface CommonColumnsOptions {
  isAscend: boolean;
  nameColumnWidth: number;
  validationOverviewVisible: boolean;
  onNameColumnResize: (event: ReactMouseEvent<HTMLSpanElement>) => void;
  renderers: ProjectTableRenderers;
}

export function createCommonColumns({
  isAscend,
  nameColumnWidth,
  validationOverviewVisible,
  onNameColumnResize,
  renderers,
}: CommonColumnsOptions): ColumnsType<ProjectTableRow> {
  const { renderProjectName, renderTextTag, renderValidationOverview } = renderers;

  return [
    {
      title: (
        <div className="resizable-column-title">
          <span>项目名称</span>
          <Tooltip title="拖拽调整列宽">
            <span
              aria-label="拖拽调整项目名称列宽"
              className="column-resize-handle"
              role="separator"
              onMouseDown={onNameColumnResize}
            />
          </Tooltip>
        </div>
      ),
      dataIndex: 'name',
      key: 'name',
      width: nameColumnWidth,
      fixed: isAscend ? undefined : 'left' as const,
      render: (name: string, record: ProjectTableRow) => {
        if (record.isVersion) return null;
        return (
          <div className="project-name-cell">
            <span className="project-name-main">
              {renderProjectName(name, record)}
            </span>
            {validationOverviewVisible && renderValidationOverview(record._project)}
          </div>
        );
      },
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: isAscend ? undefined : 130,
      render: (category: string, record: ProjectTableRow) => {
        if (record.isVersion) return null;
        return renderTextTag(category, undefined, 18, { maxWidth: 112 });
      },
    },
  ];
}
