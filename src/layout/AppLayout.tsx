import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Typography } from 'antd';
import {
  DashboardOutlined,
  TableOutlined,
  ClusterOutlined,
  CloudServerOutlined,
  AppstoreOutlined,
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
    <Layout className="app-shell">
      <Sider
        collapsible
        collapsed={collapsed}
        collapsedWidth={86}
        onCollapse={setCollapsed}
        width={248}
        className={collapsed ? 'app-sider app-sider-collapsed' : 'app-sider'}
      >
        <div className="app-brand">
          {collapsed ? (
            <div className="app-brand-mark app-brand-mark-collapsed">
              <AppstoreOutlined />
            </div>
          ) : (
            <div className="app-brand-full">
              <div className="app-brand-mark">
                <AppstoreOutlined />
              </div>
              <div className="app-brand-copy">
                <Text strong className="app-brand-title">
                  开源项目支持看板
                </Text>
                <Text className="app-brand-meta">
                  鲲鹏 {kunpengCount} + 昇腾 {ascendCount}
                </Text>
              </div>
            </div>
          )}
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={selectedKeys}
          defaultOpenKeys={['/software']}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className="app-menu"
        />
      </Sider>
      <Layout className="app-main">
        <Header className="app-header">
          <div className="app-header-copy">
            <Text className="app-header-eyebrow">Open Source Support</Text>
            <Text strong className="app-header-title">{pageTitle}</Text>
          </div>
          <Text className="app-header-meta">
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
            &nbsp;&nbsp;|&nbsp;&nbsp;鲲鹏 {kunpengCount} + 昇腾 {ascendCount} = 共 {kunpengCount + ascendCount} 个项目
          </Text>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
