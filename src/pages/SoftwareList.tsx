import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, Checkbox, Input, Popover, Space } from 'antd';
import { DownOutlined, FilterOutlined, PlusOutlined, SearchOutlined, UpOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useProjects } from '../contexts/ProjectContext';
import { Project, ProjectType } from '../types';
import ProjectFormModal from '../components/ProjectFormModal';
import ProjectTable from '../components/ProjectTable';

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

export default function SoftwareList() {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const { projects, loading, dispatch } = useProjects();
  const [search, setSearch] = useState('');
  const [hiddenColumnKeysByType, setHiddenColumnKeysByType] = useState<Record<ProjectType, string[]>>({
    鲲鹏: [],
    昇腾: ['validationOverview'],
  });
  const [expandAllRows, setExpandAllRows] = useState(false);
  const [actionColumnCollapsed, setActionColumnCollapsed] = useState(false);

  const [projModalOpen, setProjModalOpen] = useState(false);
  const [editProject, setEditProject] = useState<Project | null>(null);

  const projectType: ProjectType = location.pathname.includes('ascend') ? '昇腾' : '鲲鹏';
  const filtered = useMemo(() => {
    const ofType = projects.filter(project => project.type === projectType);
    return search
      ? ofType.filter(project => project.name.toLowerCase().includes(search.toLowerCase()))
      : ofType;
  }, [projects, projectType, search]);

  const toggleColumns = projectType === '昇腾' ? ascendToggleColumns : kunpengToggleColumns;
  const hiddenColumnKeys = hiddenColumnKeysByType[projectType];
  const validationOverviewVisible = !hiddenColumnKeys.includes('validationOverview');
  const hasExpandableRows = projectType !== '昇腾' && filtered.some(project => project.supportedVersions.length > 1);

  const setColumnVisible = (key: string, visible: boolean) => {
    setHiddenColumnKeysByType(current => ({
      ...current,
      [projectType]: visible
        ? current[projectType].filter(item => item !== key)
        : [...new Set([...current[projectType], key])],
    }));
  };

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
          <Input
            placeholder="搜索项目名称..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={event => setSearch(event.target.value)}
            style={{ width: 260 }}
            allowClear
          />
          {isAdmin && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditProject(null); setProjModalOpen(true); }}>
              新增项目
            </Button>
          )}
          <span style={{ color: '#999', fontSize: 13 }}>共 {filtered.length} 个项目</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start', gap: 12, marginTop: 10 }}>
          <Space size={8} style={{ flexShrink: 0 }}>
            {isAdmin && (
              <Button
                size="small"
                type={validationOverviewVisible ? 'primary' : 'default'}
                onClick={() => setColumnVisible('validationOverview', !validationOverviewVisible)}
              >
                {validationOverviewVisible ? '隐藏验证概览' : '显示验证概览'}
              </Button>
            )}
            <Popover content={columnFilterContent} placement="bottomRight" trigger="click">
              <Button size="small" icon={<FilterOutlined />}>
                列筛选 {visibleToggleColumnCount}/{toggleColumns.length}
              </Button>
            </Popover>
            <Button
              size="small"
              icon={expandAllRows ? <UpOutlined /> : <DownOutlined />}
              disabled={!hasExpandableRows}
              onClick={() => setExpandAllRows(value => !value)}
            >
              {expandAllRows ? '收起全部' : '展开全部'}
            </Button>
          </Space>
        </div>
      </div>
      <ProjectTable
        projects={filtered}
        projectType={projectType}
        loading={loading}
        hiddenColumnKeys={hiddenColumnKeys}
        expandAllRows={expandAllRows}
        showActions={isAdmin}
        actionColumnCollapsed={actionColumnCollapsed}
        onActionColumnCollapsedChange={setActionColumnCollapsed}
        onEditProject={(project) => {
          setEditProject(project);
          setProjModalOpen(true);
        }}
        onDeleteProject={(project) => dispatch({ type: 'DELETE_PROJECT', payload: { id: project.id } })}
      />
      <ProjectFormModal open={projModalOpen} onClose={() => setProjModalOpen(false)} editProject={editProject} defaultType={projectType} />
    </div>
  );
}
