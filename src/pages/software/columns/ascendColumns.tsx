import { Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { funcColor } from '../../../domain/projectFormat';
import type { ProjectTableRow } from '../tableRows';
import type { ProjectTableRenderers } from './types';

interface AscendColumnsOptions {
  renderers: ProjectTableRenderers;
}

export function createAscendColumns({ renderers }: AscendColumnsOptions): ColumnsType<ProjectTableRow> {
  const { renderMultiTextTags, renderTextTag } = renderers;

  return [
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
      render: (value: string) => renderMultiTextTags(value, undefined, 18, { maxWidth: 128 }),
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
}
