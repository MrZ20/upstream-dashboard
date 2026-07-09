import type { MouseEvent as ReactMouseEvent } from 'react';
import { Button, Dropdown, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowDownOutlined, ArrowUpOutlined, MinusOutlined, DownOutlined, ReloadOutlined } from '@ant-design/icons';
import { FuncStatus, PerfStatus, ProjectType } from '../../domain/projectTypes';
import type { ProjectRefreshScope } from '../../domain/projectStore';
import { funcColor, funcText, perfColor, perfText } from '../../domain/projectFormat';
import MaintainerTag from './MaintainerTag';
import type { ProjectTableRow } from './tableRows';
import { createProjectTableRenderers } from './projectTableRenderers';

const catColor: string | undefined = undefined;
const eulerColor: string | undefined = undefined;
const hwColor: string | undefined = undefined;
const upstreamColor: string | undefined = undefined;

interface ProjectColumnsOptions {
  nameColumnWidth: number;
  projectType: ProjectType;
  visibleExpandedRowKeys: string[];
  onNameColumnResize: (event: ReactMouseEvent<HTMLSpanElement>) => void;
  onRefreshAscendProject?: (name: string, scope: ProjectRefreshScope) => Promise<void> | void;
  projectRefreshing?: Record<string, boolean>;
}

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
  const catWidth = isAscend ? undefined : 130;
  const hwWidth = isAscend ? undefined : 150;
  const {
    renderMultiTextTags,
    renderProjectName,
    renderTextTag,
    renderValidationOverview,
    renderVersionTag,
  } = createProjectTableRenderers({ nameColumnWidth, validationOverviewVisible });

  const commonColumns: ColumnsType<ProjectTableRow> = [
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
      width: catWidth,
      render: (category: string, record: ProjectTableRow) => {
        if (record.isVersion) return null;
        return renderTextTag(category, catColor, 18, { maxWidth: 112 });
      },
    },
  ];

  const kunpengColumns: ColumnsType<ProjectTableRow> = [
    {
      title: '上游最新版本',
      dataIndex: 'latestVersion',
      key: 'upstream',
      width: 120,
      render: (value: string, record: ProjectTableRow) => {
        if (record.isVersion) return null;
        return renderTextTag(value, upstreamColor, 16, { maxWidth: 100 });
      },
    },
    {
      title: '支持版本',
      dataIndex: 'version',
      key: 'version',
      width: 150,
      render: (value: string, record: ProjectTableRow) => {
        if (record.isVersion && value) return renderVersionTag(value);
        if (!record.isVersion && value) {
          const isExpanded = visibleExpandedRowKeys.includes(record.key);
          const extra = !isExpanded && record.versionCount > 1 ? ` +${record.versionCount - 1}` : '';
          return renderVersionTag(value, extra);
        }
        return <span style={{ color: '#ccc' }}>-</span>;
      },
    },
    {
      title: 'openEuler 版本',
      dataIndex: 'openEuler',
      key: 'openEuler',
      width: 200,
      render: (value: string) => renderMultiTextTags(value, eulerColor, 24, { maxWidth: 180 }),
    },
    {
      title: '硬件型号',
      dataIndex: 'hardware',
      key: 'hardware',
      width: hwWidth,
      render: (value: string) => renderMultiTextTags(value, hwColor, 18, { maxWidth: 128 }),
    },
    {
      title: '功能验证',
      dataIndex: 'functional',
      key: 'functional',
      width: 140,
      render: (status: FuncStatus, record: ProjectTableRow) => {
        if (!status) return <span style={{ color: '#ccc' }}>-</span>;
        return (
          <Tooltip title={record.functionalDate ? `测试日期: ${record.functionalDate}` : undefined}>
            <Tag color={funcColor[status]} className={`status-tag status-${status}`}>
              {funcText[status]}
              {record.functionalDate && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>{record.functionalDate}</span>}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '性能验证',
      dataIndex: 'performance',
      key: 'performance',
      width: 170,
      render: (status: PerfStatus, record: ProjectTableRow) => {
        if (!status) return <span style={{ color: '#ccc' }}>-</span>;
        const icon = status === 'improvement' ? <ArrowUpOutlined /> : status === 'regression' ? <ArrowDownOutlined /> : <MinusOutlined />;
        return (
          <Tooltip title={record.performanceDate ? `测试日期: ${record.performanceDate}` : undefined}>
            <Tag color={perfColor[status]} className={`status-tag status-${status}`}>
              {icon} {perfText[status]}
              {record.performanceDate && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>{record.performanceDate}</span>}
            </Tag>
          </Tooltip>
        );
      },
    },
  ];

  const ascendColumns: ColumnsType<ProjectTableRow> = [
    {
      title: '看护分支',
      dataIndex: 'branch',
      key: 'branch',
      render: (value: string, record: ProjectTableRow) => {
        if (record.isVersion) return null;
        return renderTextTag(value || 'main', undefined, 24, { maxWidth: 160 });
      },
    },
    {
      title: '硬件型号',
      dataIndex: 'hardware',
      key: 'hardware',
      render: (value: string) => renderMultiTextTags(value, hwColor, 18, { maxWidth: 128 }),
    },
    {
      title: 'CI验证结果',
      dataIndex: 'ci',
      key: 'ci',
      render: (status: string, record: ProjectTableRow) => {
        if (status === 'pass') {
          return (
            <Tag color={funcColor.pass} className="status-tag status-pass">
              通过{record.ciDate && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>{record.ciDate}</span>}
            </Tag>
          );
        }
        if (status === 'fail') {
          return (
            <Tag color={funcColor.fail} className="status-tag status-fail">
              不通过{record.ciDate && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>{record.ciDate}</span>}
            </Tag>
          );
        }
        return <span style={{ color: '#ccc' }}>-</span>;
      },
    },
  ];

  const columns = isAscend
    ? [...commonColumns, ...ascendColumns]
    : [...commonColumns, ...kunpengColumns];

  columns.push({
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
  });

  if (isAscend && onRefreshAscendProject) {
    columns.push({
      title: '刷新',
      key: 'refresh',
      width: 150,
      render: (_: unknown, record: ProjectTableRow) => {
        if (record.isVersion) return null;
        const active = ['all', 'project', 'ci'].some(scope => projectRefreshing[`${record.name}:${scope}`]);
        return (
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                { key: 'all', label: '所有' },
                { key: 'project', label: '仅项目' },
                { key: 'ci', label: '仅 CI' },
              ],
              onClick: ({ key, domEvent }) => {
                domEvent.stopPropagation();
                void onRefreshAscendProject(record.name, key as ProjectRefreshScope);
              },
            }}
          >
            <Button
              className="row-refresh-button"
              icon={<ReloadOutlined spin={active} />}
              loading={active}
              size="small"
              type="text"
              onClick={event => event.stopPropagation()}
            >
              刷新 <DownOutlined />
            </Button>
          </Dropdown>
        );
      },
    });
  }


  return columns;
}
