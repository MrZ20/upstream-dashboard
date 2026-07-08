import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { Button, Popconfirm, Space, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CaretLeftOutlined,
  CaretRightOutlined,
  DeleteOutlined,
  EditOutlined,
  MinusOutlined,
} from '@ant-design/icons';
import { FuncStatus, PerfStatus, Project, ProjectType, VersionInfo } from '../types';
import MaintainerTag from './MaintainerTag';

const funcColor: Record<string, string> = { pass: '#16A34A', fail: '#DC2626' };
const funcText: Record<string, string> = { pass: '通过', fail: '不通过' };
const perfColor: Record<string, string> = { improvement: '#16A34A', stable: '#2563EB', regression: '#DC2626' };
const perfText: Record<string, string> = { improvement: '提升', stable: '持平', regression: '回退' };
const catColor = 'blue';
const eulerColor = 'blue';
const hwColor = 'blue';
const upstreamColor = 'blue';
const textEllipsisThreshold = 28;
const defaultNameColumnWidth = 280;
const minNameColumnWidth = 180;
const maxNameColumnWidth = 560;
const validationOverviewColors = {
  green: '#16A34A',
  yellow: '#F59E0B',
  red: '#DC2626',
  neutral: '#F3F4F6',
};
const validationOverviewNeutralText = '#6B7280';

export interface ProjectTableRow {
  key: string;
  isVersion: boolean;
  groupIndex: number;
  versionIndex?: number;
  name: string;
  category: string;
  upstream?: string;
  latestVersion?: string;
  versionCount: number;
  maintainerName?: string;
  version?: string;
  openEuler?: string;
  hardware?: string;
  functional?: FuncStatus | null;
  functionalDate?: string | null;
  performance?: PerfStatus | null;
  performanceDate?: string | null;
  ci?: string | null;
  ciDate?: string | null;
  branch?: string;
  children?: ProjectTableRow[];
  _project: Project;
}

interface ProjectTableProps {
  projects: Project[];
  projectType: ProjectType;
  loading?: boolean;
  hiddenColumnKeys?: string[];
  showActions?: boolean;
  actionColumnCollapsed?: boolean;
  onActionColumnCollapsedChange?: (collapsed: boolean) => void;
  onEditProject?: (project: Project) => void;
  onDeleteProject?: (project: Project) => void | Promise<void>;
  pagination?: false | { pageSize?: number; showSizeChanger?: boolean; showTotal?: (total: number) => string };
  expandAllRows?: boolean;
}


export function splitMultiValue(value?: string) {
  return (value || '')
    .split(';')
    .map(item => item.trim())
    .filter(Boolean);
}

export function joinUniqueValues(values: Array<string | undefined>) {
  return [...new Set(values.flatMap(splitMultiValue))].join('; ');
}

export function formatMaintainerFilter(project: Project) {
  return project.maintainer
    ? `${project.maintainer.name} <${project.maintainer.email}>`
    : '';
}

function isLongText(text: string, maxLength = textEllipsisThreshold) {
  return text.length > maxLength;
}

function truncateText(text: string, maxLength = textEllipsisThreshold) {
  if (!isLongText(text, maxLength)) return text;
  return `${text.slice(0, maxLength)}...`;
}

function isValidationGood(project: Project, version: VersionInfo) {
  if (project.type === '昇腾') return version.ci === 'pass';
  return version.functional === 'pass'
    && (version.performance === 'improvement' || version.performance === 'stable');
}

function getValidationOverview(project: Project) {
  const total = project.supportedVersions.length;
  const goodCount = project.supportedVersions.filter(version => isValidationGood(project, version)).length;

  if (!total) {
    return {
      total,
      goodCount,
      color: validationOverviewColors.neutral,
      textColor: validationOverviewNeutralText,
    };
  }

  if (goodCount === total) {
    return {
      total,
      goodCount,
      color: validationOverviewColors.green,
      textColor: '#fff',
    };
  }

  if (goodCount > 0) {
    return {
      total,
      goodCount,
      color: validationOverviewColors.yellow,
      textColor: '#fff',
    };
  }

  return {
    total,
    goodCount,
    color: validationOverviewColors.red,
    textColor: '#fff',
  };
}

export default function ProjectTable({
  projects,
  projectType,
  loading,
  hiddenColumnKeys = [],
  showActions = false,
  actionColumnCollapsed = false,
  onActionColumnCollapsedChange,
  onEditProject,
  onDeleteProject,
  pagination = { pageSize: 50, showSizeChanger: true, showTotal: total => `共 ${total} 个项目` },
  expandAllRows = false,
}: ProjectTableProps) {
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [nameColumnWidth, setNameColumnWidth] = useState(defaultNameColumnWidth);
  const isAscend = projectType === '昇腾';
  const validationOverviewVisible = !hiddenColumnKeys.includes('validationOverview');

  const allCats = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(project => set.add(project.category));
    return [...set].sort().map(value => ({ text: value, value }));
  }, [projects]);

  const allEulerVersions = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(project => project.supportedVersions.forEach(version => {
      splitMultiValue(version.openEuler).forEach(item => set.add(item));
    }));
    return [...set].sort().map(value => ({ text: value, value }));
  }, [projects]);

  const allHwModels = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(project => project.supportedVersions.forEach(version => {
      splitMultiValue(version.hardware).forEach(item => set.add(item));
    }));
    return [...set].sort().map(value => ({ text: value, value }));
  }, [projects]);

  const allMaintainers = useMemo(() => {
    const set = new Set<string>();
    projects.forEach(project => {
      const maintainer = formatMaintainerFilter(project);
      if (maintainer) set.add(maintainer);
    });
    return [...set].sort().map(value => ({ text: value, value }));
  }, [projects]);

  const treeData = useMemo(() => {
    return projects.map((project, projectIndex) => {
      const latest = project.supportedVersions[0];
      const versionChildren: ProjectTableRow[] = projectType === '昇腾' ? [] : project.supportedVersions.slice(1).map((version, childIndex) => {
        const versionIndex = childIndex + 1;
        return {
          key: `ver-${project.id}-${versionIndex}`,
          isVersion: true,
          groupIndex: projectIndex,
          versionIndex,
          name: project.name,
          category: project.category,
          versionCount: 0,
          version: version.version,
          openEuler: version.openEuler,
          hardware: version.hardware,
          functional: version.functional,
          functionalDate: version.functionalDate,
          performance: version.performance,
          performanceDate: version.performanceDate,
          ci: version.ci,
          ciDate: version.ciDate,
          _project: project,
        };
      });

      return {
        key: `proj-${project.id}`,
        isVersion: false,
        groupIndex: projectIndex,
        name: project.name,
        category: project.category,
        upstream: project.upstream || '',
        latestVersion: project.latestVersion || '',
        versionCount: project.supportedVersions.length,
        maintainerName: project.maintainer?.name,
        version: latest?.version,
        openEuler: latest?.openEuler,
        hardware: projectType === '昇腾'
          ? joinUniqueValues(project.supportedVersions.map(version => version.hardware))
          : latest?.hardware,
        functional: latest?.functional ?? null,
        functionalDate: latest?.functionalDate ?? null,
        performance: latest?.performance ?? null,
        performanceDate: latest?.performanceDate ?? null,
        ci: latest?.ci ?? null,
        ciDate: latest?.ciDate ?? null,
        branch: project.branch || 'main',
        _project: project,
        children: versionChildren.length > 0 ? versionChildren : undefined,
      };
    });
  }, [projects, projectType]);

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

  const renderProjectName = (name: string, record: ProjectTableRow) => {
    const overviewWidth = 72;
    const maxWidth = Math.max(80, nameColumnWidth - overviewWidth);
    const node = record.upstream ? (
      <a
        className="truncated-text project-name-text"
        style={{ maxWidth, fontWeight: 600 }}
        href={record.upstream}
        target="_blank"
        rel="noopener noreferrer"
      >
        {name}
      </a>
    ) : (
      <span
        className="truncated-text project-name-text"
        style={{ maxWidth, fontWeight: 600 }}
      >
        {name}
      </span>
    );

    return isLongText(name) ? <Tooltip title={name}>{node}</Tooltip> : node;
  };

  const renderValidationOverview = (project: Project) => {
    const overview = getValidationOverview(project);
    const label = project.type === '昇腾' ? 'CI验证' : '功能+性能';

    return (
      <span className="validation-overview">
        <Tooltip title={`${label}: ${overview.goodCount}/${overview.total}`}>
          <span
            className="validation-overview-block"
            style={{
              backgroundColor: overview.color,
              color: overview.textColor,
            }}
          >
            {overview.goodCount}/{overview.total}
          </span>
        </Tooltip>
      </span>
    );
  };

  const renderTextTag = (
    value?: string,
    color?: string,
    maxLength = textEllipsisThreshold,
    style?: CSSProperties,
  ) => {
    if (!value) return null;
    const tag = (
      <Tag color={color} className="truncated-tag" style={{ maxWidth: 140, ...style }}>
        {truncateText(value, maxLength)}
      </Tag>
    );
    return isLongText(value, maxLength) ? <Tooltip title={value}>{tag}</Tooltip> : tag;
  };

  const renderMultiTextTags = (
    value?: string,
    color?: string,
    maxLength = textEllipsisThreshold,
    style?: CSSProperties,
  ) => {
    const items = splitMultiValue(value);
    if (!items.length) return null;
    return (
      <Space size={[4, 4]} wrap>
        {items.map((item, index) => (
          <span key={`${item}-${index}`}>
            {renderTextTag(item, color, maxLength, style)}
          </span>
        ))}
      </Space>
    );
  };

  const renderVersionTag = (version?: string, extra = '') => {
    if (!version) return null;
    const label = `v${version}`;
    const tag = (
      <Tag
        color="blue"
        className="truncated-tag"
        style={{ maxWidth: 120, fontFamily: 'monospace', fontSize: 13 }}
      >
        {truncateText(label, 18)}
        {extra && <span style={{ color: '#999', fontSize: 11 }}>{extra}</span>}
      </Tag>
    );
    return isLongText(label, 18) ? <Tooltip title={`${label}${extra}`}>{tag}</Tooltip> : tag;
  };

  const nameWidth = nameColumnWidth;
  const catWidth = isAscend ? undefined : 130;
  const hwWidth = isAscend ? undefined : 150;

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
              onMouseDown={startNameColumnResize}
            />
          </Tooltip>
        </div>
      ), dataIndex: 'name', key: 'name', width: nameWidth, fixed: isAscend ? undefined : 'left' as const,
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
      title: '分类', dataIndex: 'category', key: 'category', width: catWidth,
      filters: allCats,
      onFilter: (value, record) => record.category === value,
      render: (category: string, record: ProjectTableRow) => {
        if (record.isVersion) return null;
        return renderTextTag(category, catColor, 18, { maxWidth: 112 });
      },
    },
  ];

  const kunpengColumns: ColumnsType<ProjectTableRow> = [
    {
      title: '上游最新版本', dataIndex: 'latestVersion', key: 'upstream', width: 120,
      render: (value: string, record: ProjectTableRow) => {
        if (record.isVersion) return null;
        return renderTextTag(value, upstreamColor, 16, { maxWidth: 100 });
      },
    },
    {
      title: '支持版本', dataIndex: 'version', key: 'version', width: 150,
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
      title: 'openEuler 版本', dataIndex: 'openEuler', key: 'openEuler', width: 200,
      filters: allEulerVersions,
      onFilter: (value, record) => splitMultiValue(record.openEuler).includes(String(value)),
      render: (value: string) => renderMultiTextTags(value, eulerColor, 24, { maxWidth: 180 }),
    },
    {
      title: '硬件型号', dataIndex: 'hardware', key: 'hardware', width: hwWidth,
      filters: allHwModels,
      onFilter: (value, record) => splitMultiValue(record.hardware).includes(String(value)),
      render: (value: string) => renderMultiTextTags(value, hwColor, 18, { maxWidth: 128 }),
    },
    {
      title: '功能验证', dataIndex: 'functional', key: 'functional', width: 140,
      filters: [{ text: '通过', value: 'pass' }, { text: '不通过', value: 'fail' }],
      onFilter: (value, record) => record.functional === value,
      render: (status: FuncStatus, record: ProjectTableRow) => {
        if (!status) return <span style={{ color: '#ccc' }}>-</span>;
        return (
          <Tooltip title={record.functionalDate ? `测试日期: ${record.functionalDate}` : undefined}>
            <Tag color={funcColor[status]}>{funcText[status]}{record.functionalDate && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>{record.functionalDate}</span>}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '性能验证', dataIndex: 'performance', key: 'performance', width: 170,
      filters: [
        { text: '提升', value: 'improvement' }, { text: '持平', value: 'stable' }, { text: '回退', value: 'regression' },
      ],
      onFilter: (value, record) => record.performance === value,
      render: (status: PerfStatus, record: ProjectTableRow) => {
        if (!status) return <span style={{ color: '#ccc' }}>-</span>;
        const icon = status === 'improvement' ? <ArrowUpOutlined /> : status === 'regression' ? <ArrowDownOutlined /> : <MinusOutlined />;
        return (
          <Tooltip title={record.performanceDate ? `测试日期: ${record.performanceDate}` : undefined}>
            <Tag color={perfColor[status]}>{icon} {perfText[status]}{record.performanceDate && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>{record.performanceDate}</span>}</Tag>
          </Tooltip>
        );
      },
    },
  ];

  const ascendColumns: ColumnsType<ProjectTableRow> = [
    {
      title: '看护分支', dataIndex: 'branch', key: 'branch',
      render: (value: string, record: ProjectTableRow) => {
        if (record.isVersion) return null;
        return renderTextTag(value || 'main', undefined, 24, { maxWidth: 160 });
      },
    },
    {
      title: '硬件型号', dataIndex: 'hardware', key: 'hardware',
      filters: allHwModels,
      onFilter: (value, record) => splitMultiValue(record.hardware).includes(String(value)),
      render: (value: string) => renderMultiTextTags(value, hwColor, 18, { maxWidth: 128 }),
    },
    {
      title: 'CI验证结果', dataIndex: 'ci', key: 'ci',
      filters: [{ text: '通过', value: 'pass' }, { text: '不通过', value: 'fail' }],
      onFilter: (value, record) => record.ci === value,
      render: (status: string, record: ProjectTableRow) => {
        if (status === 'pass') {
          return (
            <Tag color={funcColor.pass}>
              通过{record.ciDate && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>{record.ciDate}</span>}
            </Tag>
          );
        }
        if (status === 'fail') {
          return (
            <Tag color={funcColor.fail}>
              不通过{record.ciDate && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>{record.ciDate}</span>}
            </Tag>
          );
        }
        return <span style={{ color: '#ccc' }}>-</span>;
      },
    },
  ];

  const columns: ColumnsType<ProjectTableRow> = isAscend
    ? [...commonColumns, ...ascendColumns]
    : [...commonColumns, ...kunpengColumns];

  const maintainerColumn: ColumnsType<ProjectTableRow>[number] = {
    title: '维护者',
    dataIndex: 'maintainerName',
    key: 'maintainer',
    width: 120,
    fixed: isAscend ? undefined : 'right' as const,
    filters: allMaintainers,
    onFilter: (value, record) => formatMaintainerFilter(record._project) === value,
    render: (_: string, record: ProjectTableRow) => {
      if (record.isVersion) return null;
      return record._project.maintainer
        ? <MaintainerTag maintainer={record._project.maintainer} />
        : <span style={{ color: '#ccc' }}>-</span>;
    },
  };

  columns.push(maintainerColumn);

  if (showActions) {
    columns.push({
      title: (
        <div className="action-column-title">
          {!actionColumnCollapsed && <span>操作</span>}
          <Tooltip title={actionColumnCollapsed ? '展开' : '折叠'}>
            <Button
              className="action-column-toggle"
              type="text"
              size="small"
              icon={actionColumnCollapsed ? <CaretLeftOutlined /> : <CaretRightOutlined />}
              onClick={(event) => {
                event.stopPropagation();
                onActionColumnCollapsedChange?.(!actionColumnCollapsed);
              }}
            />
          </Tooltip>
        </div>
      ),
      key: 'action',
      width: actionColumnCollapsed ? 36 : 120,
      fixed: isAscend ? undefined : 'right' as const,
      align: 'center',
      className: actionColumnCollapsed ? 'action-column-collapsed' : 'action-column-expanded',
      render: (_: unknown, record: ProjectTableRow) => {
        if (actionColumnCollapsed || record.isVersion) return null;
        return (
          <Space size="small">
            <Tooltip title="编辑项目"><a onClick={() => onEditProject?.(record._project)}><EditOutlined /></a></Tooltip>
            <Popconfirm title="确定删除该项目？" onConfirm={() => onDeleteProject?.(record._project)}>
              <a style={{ color: '#ff4d4f' }}><DeleteOutlined /></a>
            </Popconfirm>
          </Space>
        );
      },
    });
  }

  const visibleColumns = columns.filter(column =>
    typeof column.key !== 'string' || !hiddenColumnKeys.includes(column.key),
  );
  const visibleScrollWidth = visibleColumns.reduce((total, column) => (
    total + (typeof column.width === 'number' ? column.width : 120)
  ), 0);
  const scrollX = Math.max(visibleScrollWidth, 900);

  return (
    <Table
      columns={visibleColumns}
      dataSource={treeData}
      rowKey="key"
      loading={loading}
      scroll={isAscend ? undefined : { x: scrollX }}
      pagination={pagination}
      size="middle"
      expandable={{
        expandedRowKeys: visibleExpandedRowKeys,
        onExpandedRowsChange: keys => setExpandedRowKeys(keys.map(String)),
        defaultExpandAllRows: false,
        indentSize: 0,
      }}
      rowClassName={(record: ProjectTableRow) => [
        record.groupIndex % 2 === 0 ? 'project-group-even' : 'project-group-odd',
        record.isVersion ? 'version-sub-row' : 'project-main-row',
      ].join(' ')}
      onRow={(record) => {
        if (record.isVersion) return {};
        return { style: { cursor: 'pointer' } };
      }}
    />
  );
}
