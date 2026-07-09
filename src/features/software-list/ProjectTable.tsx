import { useEffect, useMemo, useState, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { Space, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  MinusOutlined,
} from '@ant-design/icons';
import { FuncStatus, PerfStatus, Project, ProjectType } from '../../domain/projectTypes';
import {
  formatMaintainerFilter,
  funcColor,
  funcText,
  getValidationOverview,
  isLongText,
  joinUniqueValues,
  perfColor,
  perfText,
  splitMultiValue,
  truncateText,
} from '../../domain/projectFormat';
import MaintainerTag from './MaintainerTag';
import { buildProjectRows, type ProjectTableRow } from './tableRows';

const catColor: string | undefined = undefined;
const eulerColor: string | undefined = undefined;
const hwColor: string | undefined = undefined;
const upstreamColor: string | undefined = undefined;
const textEllipsisThreshold = 28;
const defaultNameColumnWidth = 280;
const minNameColumnWidth = 180;
const maxNameColumnWidth = 560;


interface ProjectTableProps {
  projects: Project[];
  projectType: ProjectType;
  loading?: boolean;
  pagination?: false | TablePaginationConfig;
  expandAllRows?: boolean;
}


export default function ProjectTable({
  projects,
  projectType,
  loading,
  pagination = {
    defaultPageSize: 50,
    showSizeChanger: { placement: 'topRight', getPopupContainer: () => document.body },
    pageSizeOptions: [10, 20, 50, 100],
    showTotal: total => `共 ${total} 个项目`,
  },
  expandAllRows = false,
}: ProjectTableProps) {
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [nameColumnWidth, setNameColumnWidth] = useState(defaultNameColumnWidth);
  const isAscend = projectType === '昇腾';
  const validationOverviewVisible = !isAscend;

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
        className="truncated-tag version-tag"
        style={{ maxWidth: 120 }}
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
            <Tag color={funcColor[status]} className={`status-tag status-${status}`}>{funcText[status]}{record.functionalDate && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>{record.functionalDate}</span>}</Tag>
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
            <Tag color={perfColor[status]} className={`status-tag status-${status}`}>{icon} {perfText[status]}{record.performanceDate && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>{record.performanceDate}</span>}</Tag>
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
