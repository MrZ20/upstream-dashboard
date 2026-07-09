import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Button, Dropdown, Layout, Menu, Space, Tooltip, Typography } from 'antd';
import {
  DashboardOutlined,
  TableOutlined,
  ClusterOutlined,
  CloudServerOutlined,
  AppstoreOutlined,
  DownOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';
import { useProjects } from '../domain/projectStore';

const { Sider, Content, Header } = Layout;
const { Text } = Typography;

type MenuItem = Required<MenuProps>['items'][number];

const titleMap: Record<string, string> = {
  '/overview': '总览看板',
  '/software/kunpeng': '鲲鹏领域',
  '/software/ascend': '昇腾领域',
};

function findSelectedKeys(pathname: string): string[] {
  if (pathname.startsWith('/software/')) return [pathname];
  return ['/' + pathname.split('/')[1]];
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { projects, lastUpdated, dataSource, refreshing, refreshingKey, error, refreshProjects } = useProjects();
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
  const lastUpdatedText = lastUpdated
    ? new Date(lastUpdated).toLocaleString('zh-CN', { hour12: false })
    : dataSource === 'bundled' && projects.length > 0
      ? '内置数据'
      : '等待同步';


  const renderRefreshButton = (
    key: string,
    label: string,
    options: Parameters<typeof refreshProjects>[0],
    title: string,
  ) => (
    <Tooltip title={error || title} key={key}>
      <Button
        className="app-refresh-button"
        size="small"
        icon={<ReloadOutlined spin={refreshingKey === key} />}
        loading={refreshingKey === key}
        disabled={refreshing && refreshingKey !== key}
        onClick={() => { void refreshProjects({ ...options, syncRemote: true }); }}
      >
        {label}
      </Button>
    </Tooltip>
  );

  const renderAscendRefreshDropdown = (label = '刷新数据') => {
    const active = refreshingKey?.startsWith('ascend:');
    return (
      <Dropdown
        key="ascend-refresh"
        trigger={['click']}
        menu={{
          items: [
            { key: 'all', label: '所有' },
            { key: 'project', label: '仅项目' },
            { key: 'ci', label: '仅 CI' },
          ],
          onClick: ({ key }) => {
            void refreshProjects({ domain: 'ascend', ascendScope: key as 'all' | 'project' | 'ci', syncRemote: true });
          },
        }}
      >
        <Button
          className="app-refresh-button"
          size="small"
          icon={<ReloadOutlined spin={active} />}
          loading={active}
          disabled={refreshing && !active}
        >
          {label} <DownOutlined />
        </Button>
      </Dropdown>
    );
  };

  const refreshButtons = location.pathname === '/software/kunpeng'
    ? [renderRefreshButton('kunpeng', '刷新数据', { domain: 'kunpeng' }, '从远端同步鲲鹏数据')]
    : location.pathname === '/software/ascend'
      ? [renderAscendRefreshDropdown()]
      : [
          renderRefreshButton('kunpeng', '刷新鲲鹏', { domain: 'kunpeng' }, '从远端同步鲲鹏数据'),
          renderAscendRefreshDropdown('刷新昇腾'),
        ];

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
          <Space className="app-header-actions" size={12} wrap>
            <Text className="app-header-refresh">上次刷新：{lastUpdatedText}</Text>
            {refreshButtons}
          </Space>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
