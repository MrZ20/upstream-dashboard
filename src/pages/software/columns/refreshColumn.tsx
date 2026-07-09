import { Button, Dropdown } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { DownOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ProjectRefreshScope } from '../../../domain/projectTypes';
import type { ProjectTableRow } from '../tableRows';

interface AscendRefreshColumnOptions {
  onRefreshAscendProject: (name: string, scope: ProjectRefreshScope) => Promise<void> | void;
  projectRefreshing: Record<string, boolean>;
}

export function createAscendRefreshColumn({
  onRefreshAscendProject,
  projectRefreshing,
}: AscendRefreshColumnOptions): ColumnsType<ProjectTableRow>[number] {
  return {
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
  };
}
