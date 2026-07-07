import { useState, useMemo, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { Table, Input, Tag, Button, Space, Popconfirm, Tooltip, Popover, Checkbox } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SearchOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ArrowUpOutlined, ArrowDownOutlined, MinusOutlined,
  PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined,
  DownOutlined, UpOutlined, CaretLeftOutlined, CaretRightOutlined,
  FilterOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useProjects } from '../contexts/ProjectContext';
import { Project, VersionInfo, FuncStatus, PerfStatus } from '../types';
import ProjectFormModal from '../components/ProjectFormModal';
import VersionFormModal from '../components/VersionFormModal';
import MaintainerModal from '../components/MaintainerModal';
import MaintainerTag from '../components/MaintainerTag';

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

function isLongText(text: string, maxLength = textEllipsisThreshold) {
  return text.length > maxLength;
}

function truncateText(text: string, maxLength = textEllipsisThreshold) {
  if (!isLongText(text, maxLength)) return text;
  return `${text.slice(0, maxLength)}...`;
}

function formatMaintainerFilter(project: Project) {
  return project.maintainer
    ? `${project.maintainer.name} <${project.maintainer.email}>`
    : '';
}

function isValidationGood(project: Project, version: VersionInfo) {
  if (project.type === '昇腾') return version.ci === 'pass';
  return version.functional === 'pass'
    && (version.performance === 'improvement' || version.performance === 'stable');
}

function getValidationOverview(project: Project) {
  const total = project.versions.length;
  const goodCount = project.versions.filter(version => isValidationGood(project, version)).length;

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

const kunpengToggleColumns = [
  { key: 'category', label: '分类' },
  { key: 'upstream', label: '上游最新版本' },
  { key: 'version', label: '支持版本' },
  { key: 'openEuler', label: 'openEuler 版本' },
  { key: 'hardware', label: '硬件型号' },
  { key: 'functional', label: '功能验证' },
  { key: 'performance', label: '性能验证' },
  { key: 'maintainer', label: '维护者' },
];

const ascendToggleColumns = [
  { key: 'category', label: '分类' },
  { key: 'branch', label: '看护分支' },
  { key: 'hardware', label: '硬件型号' },
  { key: 'ci', label: 'CI验证结果' },
  { key: 'maintainer', label: '维护者' },
];

interface FlatRow {
  key: string;
  isVersion: boolean;
  groupIndex: number;
  versionIndex?: number;
  name: string;
  category: string;
  upstream?: string;
  upstreamVersion?: string;
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
  children?: FlatRow[];
  _project: Project;
}

export default function SoftwareList() {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const { projects, loading, dispatch } = useProjects();
  const [search, setSearch] = useState('');
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState<string[]>([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const [nameColumnWidth, setNameColumnWidth] = useState(defaultNameColumnWidth);
  const [actionColumnCollapsed, setActionColumnCollapsed] = useState(false);

  const [projModalOpen, setProjModalOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [verModalOpen, setVerModalOpen] = useState(false);
  const [verProjectId, setVerProjectId] = useState<number>(0);
  const [editVersion, setEditVersion] = useState<VersionInfo | null>(null);
  const [editVerIndex, setEditVerIndex] = useState<number | undefined>();
  const [maintModalOpen, setMaintModalOpen] = useState(false);
  const [maintProject, setMaintProject] = useState<Project | null>(null);

  const projectType = location.pathname.includes('ascend') ? '昇腾' : '鲲鹏';
  const filtered = useMemo(() => {
    const ofType = projects.filter(p => p.type === projectType);
    return search ? ofType.filter(p => p.name.toLowerCase().includes(search.toLowerCase())) : ofType;
  }, [projects, projectType, search]);

  const allCats = useMemo(() => {
    const set = new Set<string>();
    filtered.forEach(p => set.add(p.category));
    return [...set].sort().map(v => ({ text: v, value: v }));
  }, [filtered]);

  const allEulerVersions = useMemo(() => {
    const set = new Set<string>();
    filtered.forEach(p => p.versions.forEach(v => {
      if (v.openEuler) set.add(v.openEuler);
    }));
    return [...set].sort().map(v => ({ text: v, value: v }));
  }, [filtered]);

  const allHwModels = useMemo(() => {
    const set = new Set<string>();
    filtered.forEach(p => p.versions.forEach(v => set.add(v.hardware)));
    return [...set].sort().map(v => ({ text: v, value: v }));
  }, [filtered]);

  const allMaintainers = useMemo(() => {
    const set = new Set<string>();
    filtered.forEach(p => {
      const maintainer = formatMaintainerFilter(p);
      if (maintainer) set.add(maintainer);
    });
    return [...set].sort().map(v => ({ text: v, value: v }));
  }, [filtered]);

  const treeData = useMemo(() => {
    return filtered.map((p, projectIndex) => {
      const latest = p.versions[0];
      const versionChildren: FlatRow[] = p.versions.slice(1).map((v, childIndex) => {
        const versionIndex = childIndex + 1;
        return {
          key: `ver-${p.id}-${versionIndex}`,
          isVersion: true,
          groupIndex: projectIndex,
          versionIndex,
          name: p.name,
          category: p.category,
          versionCount: 0,
          version: v.version,
          openEuler: v.openEuler,
          hardware: v.hardware,
          functional: v.functional,
          functionalDate: v.functionalDate,
          performance: v.performance,
          performanceDate: v.performanceDate,
          ci: v.ci,
          ciDate: v.ciDate,
          _project: p,
        };
      });

      return {
        key: `proj-${p.id}`,
        isVersion: false,
        groupIndex: projectIndex,
        name: p.name,
        category: p.category,
        upstream: p.upstream || '',
        upstreamVersion: p.upstreamVersion || '',
        versionCount: p.versions.length,
        maintainerName: p.maintainer?.name,
        version: latest?.version,
        openEuler: latest?.openEuler,
        hardware: latest?.hardware,
        functional: latest?.functional ?? null,
        functionalDate: latest?.functionalDate ?? null,
        performance: latest?.performance ?? null,
        performanceDate: latest?.performanceDate ?? null,
        ci: latest?.ci ?? null,
        ciDate: latest?.ciDate ?? null,
        branch: p.branch || 'main',
        _project: p,
        children: versionChildren.length > 0 ? versionChildren : undefined,
      };
    });
  }, [filtered]);

  const isAscend = projectType === '昇腾';
  const toggleColumns = isAscend ? ascendToggleColumns : kunpengToggleColumns;
  const expandableRowKeys = useMemo(
    () => treeData.filter(row => row.children?.length).map(row => row.key),
    [treeData],
  );
  const visibleExpandedRowKeys = expandedRowKeys.filter(key => expandableRowKeys.includes(key));
  const hasExpandableRows = expandableRowKeys.length > 0;
  const allRowsExpanded = hasExpandableRows && expandableRowKeys.every(key => visibleExpandedRowKeys.includes(key));

  const setColumnVisible = (key: string, visible: boolean) => {
    setHiddenColumnKeys(keys =>
      visible ? keys.filter(item => item !== key) : [...new Set([...keys, key])],
    );
  };

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

  const renderProjectName = (name: string, record: FlatRow) => {
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

  const commonColumns: ColumnsType<any> = [
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
      render: (name: string, record: FlatRow) => {
        if (record.isVersion) return null;
        return (
          <div className="project-name-cell">
            <span className="project-name-main">
              {renderProjectName(name, record)}
            </span>
            {renderValidationOverview(record._project)}
          </div>
        );
      },
    },
    {
      title: '分类', dataIndex: 'category', key: 'category', width: catWidth,
      filters: allCats,
      onFilter: (value, record) => record.category === value,
      render: (c: string, record: FlatRow) => {
        if (record.isVersion) return null;
        return renderTextTag(c, catColor, 18, { maxWidth: 112 });
      },
    },
  ];

  const kunpengColumns: ColumnsType<any> = [
    {
      title: '上游最新版本', dataIndex: 'upstreamVersion', key: 'upstream', width: 120,
      render: (v: string, record: FlatRow) => {
        if (record.isVersion) return null;
        return renderTextTag(v, upstreamColor, 16, { maxWidth: 100 });
      },
    },
    {
      title: '支持版本', dataIndex: 'version', key: 'version', width: 150,
      render: (v: string, record: FlatRow) => {
        if (record.isVersion && v) return renderVersionTag(v);
        if (!record.isVersion && v) {
          const isExpanded = visibleExpandedRowKeys.includes(record.key);
          const extra = !isExpanded && record.versionCount > 1 ? ` +${record.versionCount - 1}` : '';
          return renderVersionTag(v, extra);
        }
        return <span style={{ color: '#ccc' }}>-</span>;
      },
    },
    {
      title: 'openEuler 版本', dataIndex: 'openEuler', key: 'openEuler', width: 200,
      filters: allEulerVersions,
      onFilter: (value, record) => record.openEuler === value,
      render: (v: string, record: FlatRow) => {
        return renderTextTag(v, eulerColor, 24, { maxWidth: 180 });
      },
    },
    {
      title: '硬件型号', dataIndex: 'hardware', key: 'hardware', width: hwWidth,
      filters: allHwModels,
      onFilter: (value, record) => record.hardware === value,
      render: (v: string, record: FlatRow) => {
        return renderTextTag(v, hwColor, 18, { maxWidth: 128 });
      },
    },
    {
      title: '功能验证', dataIndex: 'functional', key: 'functional', width: 140,
      filters: [{ text: '通过', value: 'pass' }, { text: '不通过', value: 'fail' }],
      onFilter: (value, record) => record.functional === value,
      render: (s: FuncStatus, record: FlatRow) => {
        if (!s) return <span style={{ color: '#ccc' }}>-</span>;
        return (
          <Tooltip title={record.functionalDate ? `测试日期: ${record.functionalDate}` : undefined}>
            <Tag color={funcColor[s]}>{funcText[s]}{record.functionalDate && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>{record.functionalDate}</span>}</Tag>
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
      render: (s: PerfStatus, record: FlatRow) => {
        if (!s) return <span style={{ color: '#ccc' }}>-</span>;
        const icon = s === 'improvement' ? <ArrowUpOutlined /> : s === 'regression' ? <ArrowDownOutlined /> : <MinusOutlined />;
        return (
          <Tooltip title={record.performanceDate ? `测试日期: ${record.performanceDate}` : undefined}>
            <Tag color={perfColor[s]}>{icon} {perfText[s]}{record.performanceDate && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>{record.performanceDate}</span>}</Tag>
          </Tooltip>
        );
      },
    },
  ];

  const ascendColumns: ColumnsType<any> = [
    {
      title: '看护分支', dataIndex: 'branch', key: 'branch',
      render: (v: string, record: FlatRow) => {
        if (record.isVersion) return null;
        return renderTextTag(v || 'main', undefined, 24, { maxWidth: 160 });
      },
    },
    {
      title: '硬件型号', dataIndex: 'hardware', key: 'hardware',
      filters: allHwModels,
      onFilter: (value, record) => record.hardware === value,
      render: (v: string, record: FlatRow) => {
        return renderTextTag(v, hwColor, 18, { maxWidth: 128 });
      },
    },
    {
      title: 'CI验证结果', dataIndex: 'ci', key: 'ci',
      filters: [{ text: '通过', value: 'pass' }, { text: '不通过', value: 'fail' }],
      onFilter: (value, record) => record.ci === value,
      render: (s: string, record: FlatRow) => {
        if (s === 'pass') {
          return (
            <Tag color={funcColor.pass}>
              通过{record.ciDate && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>{record.ciDate}</span>}
            </Tag>
          );
        }
        if (s === 'fail') {
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

  const columns: ColumnsType<any> = isAscend
    ? [...commonColumns, ...ascendColumns]
    : [...commonColumns, ...kunpengColumns];

  const maintainerColumn: ColumnsType<any>[number] = {
    title: '维护者',
    dataIndex: 'maintainerName',
    key: 'maintainer',
    width: 120,
    fixed: isAscend ? undefined : 'right' as const,
    filters: allMaintainers,
    onFilter: (value, record) => formatMaintainerFilter(record._project) === value,
    render: (_: string, record: FlatRow) => {
      if (record.isVersion) return null;
      return record._project.maintainer
        ? <MaintainerTag maintainer={record._project.maintainer} />
        : <span style={{ color: '#ccc' }}>-</span>;
    },
  };

  columns.push(maintainerColumn);

  if (isAdmin) {
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
                setActionColumnCollapsed(value => !value);
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
      render: (_: unknown, record: FlatRow) => {
        if (actionColumnCollapsed) return null;
        if (record.isVersion) {
          return (
            <Space size="small">
              <Tooltip title="编辑版本"><a onClick={() => {
                setVerProjectId(record._project.id);
                setEditVersion(record._project.versions[record.versionIndex!]);
                setEditVerIndex(record.versionIndex);
                setVerModalOpen(true);
              }}><EditOutlined /></a></Tooltip>
              <Popconfirm title="确定删除该版本？" onConfirm={async () => {
                await dispatch({ type: 'DELETE_VERSION', payload: { projectId: record._project.id, versionIndex: record.versionIndex! } });
              }}>
                <a style={{ color: '#ff4d4f' }}><DeleteOutlined /></a>
              </Popconfirm>
            </Space>
          );
        }
        return (
          <Space size="small">
            <Tooltip title="编辑项目"><a onClick={() => { setEditProject(record._project); setProjModalOpen(true); }}><EditOutlined /></a></Tooltip>
            <Tooltip title="添加版本"><a onClick={() => { setVerProjectId(record._project.id); setEditVersion(null); setEditVerIndex(undefined); setVerModalOpen(true); }}><PlusOutlined /></a></Tooltip>
            <Tooltip title="设置维护者"><a onClick={() => { setMaintProject(record._project); setMaintModalOpen(true); }}><UserOutlined /></a></Tooltip>
            <Popconfirm title="确定删除该项目？" onConfirm={async () => { await dispatch({ type: 'DELETE_PROJECT', payload: { id: record._project.id } }); }}>
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
  const visibleToggleColumnCount = toggleColumns.filter(column => !hiddenColumnKeys.includes(column.key)).length;
  const columnFilterContent = (
    <div className="column-filter-panel">
      {toggleColumns.map(column => (
        <Checkbox
          key={column.key}
          checked={!hiddenColumnKeys.includes(column.key)}
          onChange={event => setColumnVisible(column.key, event.target.checked)}
        >
          {column.label}
        </Checkbox>
      ))}
    </div>
  );

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Input placeholder="搜索项目名称..." prefix={<SearchOutlined />} value={search}
            onChange={e => setSearch(e.target.value)} style={{ width: 260 }} allowClear />
          {isAdmin && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditProject(null); setProjModalOpen(true); }}>
              新增项目
            </Button>
          )}
          <span style={{ color: '#999', fontSize: 13 }}>共 {filtered.length} 个项目</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', gap: 12, marginTop: 10 }}>
          <Space size={8} style={{ flexShrink: 0 }}>
            <Popover
              content={columnFilterContent}
              placement="bottomRight"
              trigger="click"
            >
              <Button size="small" icon={<FilterOutlined />}>
                列筛选 {visibleToggleColumnCount}/{toggleColumns.length}
              </Button>
            </Popover>
            <Button
              size="small"
              icon={allRowsExpanded ? <UpOutlined /> : <DownOutlined />}
              disabled={!hasExpandableRows}
              onClick={() => setExpandedRowKeys(allRowsExpanded ? [] : expandableRowKeys)}
            >
              {allRowsExpanded ? '收起全部' : '展开全部'}
            </Button>
          </Space>
        </div>
      </div>
      <Table
        columns={visibleColumns} dataSource={treeData} rowKey="key"
        loading={loading}
        scroll={isAscend ? undefined : { x: scrollX }}
        pagination={{ pageSize: 50, showSizeChanger: true, showTotal: total => `共 ${total} 个项目` }}
        size="middle"
        expandable={{
          expandedRowKeys: visibleExpandedRowKeys,
          onExpandedRowsChange: keys => setExpandedRowKeys(keys.map(String)),
          defaultExpandAllRows: false,
          indentSize: 0,
        }}
        rowClassName={(record: FlatRow) => [
          record.groupIndex % 2 === 0 ? 'project-group-even' : 'project-group-odd',
          record.isVersion ? 'version-sub-row' : 'project-main-row',
        ].join(' ')}
        onRow={(record) => {
          if (record.isVersion) return {};
          return { style: { cursor: 'pointer' } };
        }}
      />
      <ProjectFormModal open={projModalOpen} onClose={() => setProjModalOpen(false)} editProject={editProject} defaultType={projectType} />
      <VersionFormModal open={verModalOpen} onClose={() => setVerModalOpen(false)} projectId={verProjectId} editVersion={editVersion} versionIndex={editVerIndex} />
      <MaintainerModal open={maintModalOpen} onClose={() => setMaintModalOpen(false)} project={maintProject} />
    </div>
  );
}
