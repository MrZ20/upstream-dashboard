import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button, Input } from 'antd';
import { DownOutlined, SearchOutlined, UpOutlined } from '@ant-design/icons';
import { useProjects } from '../../domain/projectStore';
import { ProjectType } from '../../domain/projectTypes';
import ProjectTable from './ProjectTable';

export default function SoftwareList() {
  const location = useLocation();
  const { projects, loading } = useProjects();
  const [search, setSearch] = useState('');
  const [expandAllRows, setExpandAllRows] = useState(false);

  const projectType: ProjectType = location.pathname.includes('ascend') ? '昇腾' : '鲲鹏';
  const filtered = useMemo(() => {
    const ofType = projects.filter(project => project.type === projectType);
    return search
      ? ofType.filter(project => project.name.toLowerCase().includes(search.toLowerCase()))
      : ofType;
  }, [projects, projectType, search]);

  const hasExpandableRows = projectType !== '昇腾' && filtered.some(project => project.supportedVersions.length > 1);

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
          <span style={{ color: '#999', fontSize: 13 }}>共 {filtered.length} 个项目</span>
          <div style={{ flex: 1 }} />
          <Button
            size="small"
            icon={expandAllRows ? <UpOutlined /> : <DownOutlined />}
            disabled={!hasExpandableRows}
            onClick={() => setExpandAllRows(value => !value)}
          >
            {expandAllRows ? '收起全部' : '展开全部'}
          </Button>
        </div>
      </div>
      <ProjectTable
        projects={filtered}
        projectType={projectType}
        loading={loading}
        expandAllRows={expandAllRows}
      />
    </div>
  );
}
