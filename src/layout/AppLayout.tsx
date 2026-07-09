import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography } from 'antd';
import {
  DashboardOutlined,
  TableOutlined,
  SettingOutlined,
  ClusterOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useProjects } from '../domain/projectStore';

const { Sider, Content, Header } = Layout;
const { Text } = Typography;

type MenuItem = Required<MenuProps>['items'][number];

const titleMap: Record<string, string> = {
  '/overview': '总览看板',
  '/software/kunpeng': '软件列表 — 鲲鹏领域',
  '/software/ascend': '软件列表 — 昇腾领域',
};

function findSelectedKeys(pathname: string): string[] {
  if (pathname.startsWith('/software/')) return [pathname];
  return ['/' + pathname.split('/')[1]];
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { projects } = useProjects();
  const menuItems: MenuItem[] = [
    { key: '/overview', icon: <DashboardOutlined />, label: '总览看板' },
    {
      key: '/software',
      icon: <TableOutlined />,
      label: '软件列表',
      children: [
        { key: '/software/kunpeng', icon: <ClusterOutlined />, label: '鲲鹏领域' },
        { key: '/software/ascend', icon: <CloudServerOutlined />, label: '昇腾领域' },
      ],
    },
  ];

  const selectedKeys = findSelectedKeys(location.pathname);
  const pageTitle = titleMap[location.pathname] || '看板';

  const kunpengCount = projects.filter(p => p.type === '鲲鹏').length;
  const ascendCount = projects.filter(p => p.type === '昇腾').length;

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        width={200}
        style={{
          height: '100vh',
          overflow: 'auto',
          overscrollBehavior: 'contain',
          background: '#001529',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}>
          {collapsed ? (
            <SettingOutlined style={{ fontSize: 24, color: '#0066CC' }} />
          ) : (
            <div style={{ textAlign: 'center' }}>
              <Text strong style={{ color: '#fff', fontSize: 15 }}>
                开源项目支持看板
              </Text>
              <br />
              <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                鲲鹏 {kunpengCount} + 昇腾 {ascendCount}
              </Text>
            </div>
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={['/software']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ borderInlineEnd: 'none' }}
        />
      </Sider>
      <Layout style={{ height: '100vh', minWidth: 0, overflow: 'hidden' }}>
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <Text strong style={{ fontSize: 16 }}>{pageTitle}</Text>
          <Text type="secondary" style={{ fontSize: 13 }}>
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            &nbsp;&nbsp;|&nbsp;&nbsp;鲲鹏 {kunpengCount} + 昇腾 {ascendCount} = 共 {kunpengCount + ascendCount} 个项目
          </Text>
        </Header>
        <Content style={{ height: 'calc(100vh - 64px)', padding: 24, overflow: 'auto', overscrollBehavior: 'contain' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
