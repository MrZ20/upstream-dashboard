import { Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ArrowDownOutlined, ArrowUpOutlined, MinusOutlined } from '@ant-design/icons';
import { funcColor, funcText, perfColor, perfText } from '../../../domain/projectFormat';
import type { FuncStatus, PerfStatus } from '../../../domain/projectTypes';
import type { ProjectTableRow } from '../tableRows';
import type { ProjectTableRenderers } from './types';

interface KunpengColumnsOptions {
  visibleExpandedRowKeys: string[];
  renderers: ProjectTableRenderers;
}

export function createKunpengColumns({
  visibleExpandedRowKeys,
  renderers,
}: KunpengColumnsOptions): ColumnsType<ProjectTableRow> {
  const { renderMultiTextTags, renderTextTag, renderVersionTag } = renderers;

  return [
    {
      title: '上游最新版本',
      dataIndex: 'latestVersion',
      key: 'upstream',
      width: 120,
      render: (value: string, record: ProjectTableRow) => {
        if (record.isVersion) return null;
        return renderTextTag(value, undefined, 16, { maxWidth: 100 });
      },
    },
    {
      title: '支持版本',
      dataIndex: 'version',
      key: 'version',
      width: 150,
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
      title: 'openEuler 版本',
      dataIndex: 'openEuler',
      key: 'openEuler',
      width: 200,
      render: (value: string) => renderMultiTextTags(value, undefined, 24, { maxWidth: 180 }),
    },
    {
      title: '硬件型号',
      dataIndex: 'hardware',
      key: 'hardware',
      width: 150,
      render: (value: string) => renderMultiTextTags(value, undefined, 18, { maxWidth: 128 }),
    },
    {
      title: '功能验证',
      dataIndex: 'functional',
      key: 'functional',
      width: 140,
      render: (status: FuncStatus, record: ProjectTableRow) => {
        if (!status) return <span style={{ color: '#ccc' }}>-</span>;
        return (
          <Tooltip title={record.functionalDate ? `测试日期: ${record.functionalDate}` : undefined}>
            <Tag color={funcColor[status]} className={`status-tag status-${status}`}>
              {funcText[status]}
              {record.functionalDate && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>{record.functionalDate}</span>}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '性能验证',
      dataIndex: 'performance',
      key: 'performance',
      width: 170,
      render: (status: PerfStatus, record: ProjectTableRow) => {
        if (!status) return <span style={{ color: '#ccc' }}>-</span>;
        const icon = status === 'improvement' ? <ArrowUpOutlined /> : status === 'regression' ? <ArrowDownOutlined /> : <MinusOutlined />;
        return (
          <Tooltip title={record.performanceDate ? `测试日期: ${record.performanceDate}` : undefined}>
            <Tag color={perfColor[status]} className={`status-tag status-${status}`}>
              {icon} {perfText[status]}
              {record.performanceDate && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>{record.performanceDate}</span>}
            </Tag>
          </Tooltip>
        );
      },
    },
  ];
}
