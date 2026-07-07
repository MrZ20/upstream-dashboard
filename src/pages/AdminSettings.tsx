import { useState, type KeyboardEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Button, Card, Form, Input, message, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  CloseOutlined,
  MinusOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useAuth } from '../contexts/AuthContext';
import { useProjects } from '../contexts/ProjectContext';
import { FuncStatus, PerfStatus, Project, ProjectType } from '../types';
import MaintainerTag from '../components/MaintainerTag';

const { Text, Paragraph } = Typography;

type PreviewProject = Omit<Project, 'id'>;
interface PreviewRow {
  key: string;
  isVersion: boolean;
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
  children?: PreviewRow[];
  _project: PreviewProject;
}

const funcColor: Record<string, string> = { pass: '#16A34A', fail: '#DC2626' };
const funcText: Record<string, string> = { pass: '通过', fail: '不通过' };
const perfColor: Record<string, string> = { improvement: '#16A34A', stable: '#2563EB', regression: '#DC2626' };
const perfText: Record<string, string> = { improvement: '提升', stable: '持平', regression: '回退' };
const catColor = 'blue';
const eulerColor = 'blue';
const hwColor = 'blue';
const upstreamColor = 'blue';

const kunpengValueGuide = [
  { field: 'functional', values: ['pass（通过）', 'fail（不通过）'] },
  { field: 'performance', values: ['improvement（提升）', 'stable（持平）', 'regression（回退）'] },
];

const ascendValueGuide = [
  { field: 'ci', values: ['pass（通过）', 'fail（不通过）'] },
];

const exampleKunpeng = {
  name: 'ExampleLib',
  category: '基础库&加速库',
  upstream: 'https://github.com/example/example-lib',
  upstreamVersion: '1.2.3',
  maintainer: {
    name: 'zhangsan',
    email: 'zhangsan@example.com',
  },
  versions: [
    {
      version: '1.0.0',
      openEuler: 'openEuler 24.03 LTS',
      hardware: 'Kunpeng 930',
      functional: 'pass',
      functionalDate: '2026-07-06',
      performance: 'stable',
      performanceDate: '2026-07-06',
      integratedDate: '2026-07-06',
    },
  ],
};

const exampleAscend = {
  name: 'ExampleAI',
  category: '推理加速',
  branch: 'main',
  maintainer: {
    name: 'lisi',
    email: 'lisi@example.com',
  },
  versions: [
    {
      version: '1.0.0',
      hardware: 'Ascend 910B',
      ci: 'pass',
      ciDate: '2026-07-06',
      integratedDate: '2026-07-06',
    },
  ],
};

function normalizeImportedProject(input: Partial<Project>, type: ProjectType): Omit<Project, 'id'> {
  if (!input.name || !input.category) {
    throw new Error('每条软件信息至少需要 name 和 category');
  }
  validateProjectOptions(input, type);

  return type === '鲲鹏'
    ? {
        name: input.name,
        type,
        category: input.category,
        upstream: input.upstream || '',
        upstreamVersion: input.upstreamVersion || '',
        maintainer: input.maintainer,
        versions: input.versions || [],
      }
    : {
        name: input.name,
        type,
        category: input.category,
        branch: input.branch || 'main',
        maintainer: input.maintainer,
        versions: input.versions || [],
      };
}

function getExampleText(type: ProjectType) {
  const objectText = JSON.stringify(type === '鲲鹏' ? exampleKunpeng : exampleAscend, null, 2)
    .split('\n')
    .map(line => `  ${line}`)
    .join('\n');

  return `[\n${objectText},\n]`;
}

function parseProjectInput(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    const withoutTrailingCommas = value.replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(withoutTrailingCommas);
  }
}

function assertOption(
  value: unknown,
  allowedValues: readonly string[],
  fieldPath: string,
) {
  if (value == null || value === '') return;
  if (typeof value !== 'string' || !allowedValues.includes(value)) {
    throw new Error(`${fieldPath} 只能填写：${allowedValues.join(' / ')}`);
  }
}

function validateProjectOptions(input: Partial<Project>, type: ProjectType) {
  if (!input.versions) return;
  if (!Array.isArray(input.versions)) {
    throw new Error('versions 必须是数组');
  }

  input.versions.forEach((version, index) => {
    const prefix = `versions[${index}]`;
    if (type === '鲲鹏') {
      assertOption(version.functional, ['pass', 'fail'], `${prefix}.functional`);
      assertOption(version.performance, ['improvement', 'stable', 'regression'], `${prefix}.performance`);
      return;
    }

    assertOption(version.ci, ['pass', 'fail'], `${prefix}.ci`);
  });
}

export default function AdminSettings() {
  const { isAdmin } = useAuth();
  const { dispatch, reload } = useProjects();
  const [type, setType] = useState<ProjectType>('鲲鹏');
  const [jsonText, setJsonText] = useState(getExampleText('鲲鹏'));
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [previewType, setPreviewType] = useState<ProjectType>('鲲鹏');
  const [previewProjects, setPreviewProjects] = useState<PreviewProject[]>([]);
  const valueGuide = type === '鲲鹏' ? kunpengValueGuide : ascendValueGuide;

  if (!isAdmin) {
    return <Navigate to="/overview" replace />;
  }

  const handleTypeChange = (nextType: ProjectType) => {
    setType(nextType);
    setJsonText(getExampleText(nextType));
    setPreviewProjects([]);
  };

  const handleReload = async () => {
    setReloading(true);
    try {
      await reload();
      setJsonText(getExampleText(type));
      setPreviewProjects([]);
      message.success('已重新加载数据并重置示例 JSON');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '重新加载失败');
    } finally {
      setReloading(false);
    }
  };

  const handleJsonChange = (value: string) => {
    setJsonText(value);
    setPreviewProjects([]);
  };

  const handleJsonKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Tab') return;

    event.preventDefault();

    const indent = '  ';
    const textarea = event.currentTarget;
    const { selectionStart, selectionEnd, value } = textarea;

    const applyText = (nextValue: string, nextStart: number, nextEnd: number) => {
      setJsonText(nextValue);
      setPreviewProjects([]);
      window.requestAnimationFrame(() => {
        textarea.setSelectionRange(nextStart, nextEnd);
      });
    };

    if (selectionStart === selectionEnd) {
      if (!event.shiftKey) {
        applyText(
          `${value.slice(0, selectionStart)}${indent}${value.slice(selectionEnd)}`,
          selectionStart + indent.length,
          selectionStart + indent.length,
        );
        return;
      }

      const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
      const removeCount = value.startsWith(indent, lineStart)
        ? indent.length
        : value[lineStart] === '\t'
          ? 1
          : 0;

      if (removeCount === 0) return;

      applyText(
        `${value.slice(0, lineStart)}${value.slice(lineStart + removeCount)}`,
        Math.max(lineStart, selectionStart - removeCount),
        Math.max(lineStart, selectionEnd - removeCount),
      );
      return;
    }

    const blockStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
    const blockEndIndex = value.indexOf('\n', selectionEnd);
    const blockEnd = blockEndIndex === -1 ? value.length : blockEndIndex;
    const lines = value.slice(blockStart, blockEnd).split('\n');

    if (!event.shiftKey) {
      const nextBlock = lines.map(line => `${indent}${line}`).join('\n');
      const addedLength = lines.length * indent.length;

      applyText(
        `${value.slice(0, blockStart)}${nextBlock}${value.slice(blockEnd)}`,
        selectionStart + indent.length,
        selectionEnd + addedLength,
      );
      return;
    }

    let totalRemoved = 0;
    let removedBeforeSelection = 0;
    let currentLineStart = blockStart;
    const nextBlock = lines.map((line) => {
      const removeCount = line.startsWith(indent)
        ? indent.length
        : line.startsWith('\t')
          ? 1
          : 0;

      if (currentLineStart < selectionStart) {
        removedBeforeSelection += removeCount;
      }

      totalRemoved += removeCount;
      currentLineStart += line.length + 1;
      return line.slice(removeCount);
    }).join('\n');

    applyText(
      `${value.slice(0, blockStart)}${nextBlock}${value.slice(blockEnd)}`,
      Math.max(blockStart, selectionStart - removedBeforeSelection),
      Math.max(blockStart, selectionEnd - totalRemoved),
    );
  };

  const handleAddPreview = () => {
    if (!isAdmin) {
      message.warning('请先进入管理模式');
      return;
    }

    try {
      const parsed = parseProjectInput(jsonText);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const normalizedItems = items.map(item => normalizeImportedProject(item, type));

      setPreviewType(type);
      setPreviewProjects(normalizedItems);
      message.success(`已生成 ${normalizedItems.length} 条${type}软件预览`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : 'JSON 解析失败');
    }
  };

  const handleCancelPreview = () => {
    setPreviewProjects([]);
    message.info('已取消预览');
  };

  const handleSavePreview = async () => {
    setSaving(true);
    try {
      for (const project of previewProjects) {
        await dispatch({ type: 'ADD_PROJECT', payload: project });
      }

      message.success(`已保存 ${previewProjects.length} 条${previewType}软件信息`);
      setPreviewProjects([]);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const previewRows: PreviewRow[] = previewProjects.map((project, index) => {
    const latest = project.versions[0];
    const children = project.versions.map((version, versionIndex) => ({
      key: `preview-ver-${index}-${versionIndex}`,
      isVersion: true,
      versionIndex,
      name: project.name,
      category: project.category,
      versionCount: 0,
      version: version.version,
      openEuler: version.openEuler,
      hardware: version.hardware,
      functional: version.functional,
      functionalDate: version.functionalDate,
      performance: version.performance,
      performanceDate: version.performanceDate,
      ci: version.ci,
      ciDate: version.ciDate,
      _project: project,
    }));

    return {
      key: `preview-proj-${index}`,
      isVersion: false,
      name: project.name,
      category: project.category,
      upstream: project.upstream || '',
      upstreamVersion: project.upstreamVersion || '',
      versionCount: project.versions.length,
      maintainerName: project.maintainer?.name,
      version: latest?.version,
      openEuler: latest?.openEuler,
      hardware: latest?.hardware,
      functional: latest?.functional ?? null,
      functionalDate: latest?.functionalDate ?? null,
      performance: latest?.performance ?? null,
      performanceDate: latest?.performanceDate ?? null,
      ci: latest?.ci ?? null,
      ciDate: latest?.ciDate ?? null,
      branch: project.branch || 'main',
      _project: project,
      children: children.length > 0 ? children : undefined,
    };
  });

  const isAscendPreview = previewType === '昇腾';
  const nameWidth = isAscendPreview ? undefined : 280;
  const catWidth = isAscendPreview ? undefined : 130;
  const hwWidth = isAscendPreview ? undefined : 150;

  const commonPreviewColumns: ColumnsType<PreviewRow> = [
    {
      title: '项目名称', dataIndex: 'name', key: 'name', width: nameWidth,
      render: (name: string, record: PreviewRow) => {
        if (record.isVersion) return null;
        return (
          <Space>
            {record.upstream ? (
              <a style={{ fontWeight: 600 }} href={record.upstream} target="_blank" rel="noopener noreferrer">{name}</a>
            ) : (
              <span style={{ fontWeight: 600 }}>{name}</span>
            )}
            {record._project.maintainer && <MaintainerTag maintainer={record._project.maintainer} />}
          </Space>
        );
      },
    },
    {
      title: '分类', dataIndex: 'category', key: 'category', width: catWidth,
      render: (category: string, record: PreviewRow) => {
        if (record.isVersion) return null;
        return category ? <Tag color={catColor}>{category}</Tag> : null;
      },
    },
  ];

  const kunpengPreviewColumns: ColumnsType<PreviewRow> = [
    {
      title: '上游最新版本', dataIndex: 'upstreamVersion', key: 'upstream', width: 120,
      render: (value: string, record: PreviewRow) => {
        if (record.isVersion) return null;
        return value ? <Tag color={upstreamColor}>{value}</Tag> : null;
      },
    },
    {
      title: '支持版本', dataIndex: 'version', key: 'version', width: 150,
      render: (value: string, record: PreviewRow) => {
        if (record.isVersion && value) return <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: 13 }}>v{value}</Tag>;
        if (!record.isVersion && value) {
          const extra = record.versionCount > 1 ? ` +${record.versionCount - 1}` : '';
          return <Tag color="blue" style={{ fontFamily: 'monospace', fontSize: 13 }}>v{value}{extra && <span style={{ color: '#999', fontSize: 11 }}>{extra}</span>}</Tag>;
        }
        return <span style={{ color: '#ccc' }}>-</span>;
      },
    },
    {
      title: 'openEuler 版本', dataIndex: 'openEuler', key: 'openEuler', width: 200,
      render: (value: string) => value ? <Tag color={eulerColor}>{value}</Tag> : null,
    },
    {
      title: '硬件型号', dataIndex: 'hardware', key: 'hardware', width: hwWidth,
      render: (value: string) => value ? <Tag color={hwColor}>{value}</Tag> : null,
    },
    {
      title: '功能验证', dataIndex: 'functional', key: 'functional', width: 140,
      render: (status: FuncStatus, record: PreviewRow) => {
        if (!status) return <span style={{ color: '#ccc' }}>-</span>;
        return (
          <Tooltip title={record.functionalDate ? `测试日期: ${record.functionalDate}` : undefined}>
            <Tag color={funcColor[status]}>{funcText[status]}{record.functionalDate && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>{record.functionalDate}</span>}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: '性能验证', dataIndex: 'performance', key: 'performance', width: 170,
      render: (status: PerfStatus, record: PreviewRow) => {
        if (!status) return <span style={{ color: '#ccc' }}>-</span>;
        const icon = status === 'improvement' ? <ArrowUpOutlined /> : status === 'regression' ? <ArrowDownOutlined /> : <MinusOutlined />;
        return (
          <Tooltip title={record.performanceDate ? `测试日期: ${record.performanceDate}` : undefined}>
            <Tag color={perfColor[status]}>{icon} {perfText[status]}{record.performanceDate && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>{record.performanceDate}</span>}</Tag>
          </Tooltip>
        );
      },
    },
  ];

  const ascendPreviewColumns: ColumnsType<PreviewRow> = [
    {
      title: '看护分支', dataIndex: 'branch', key: 'branch',
      render: (value: string, record: PreviewRow) => {
        if (record.isVersion) return null;
        return value ? <Tag>{value}</Tag> : <Tag>main</Tag>;
      },
    },
    {
      title: '硬件型号', dataIndex: 'hardware', key: 'hardware',
      render: (value: string) => value ? <Tag color={hwColor}>{value}</Tag> : null,
    },
    {
      title: 'CI验证结果', dataIndex: 'ci', key: 'ci',
      render: (status: string, record: PreviewRow) => {
        if (record.isVersion) return null;
        if (status === 'pass') {
          return (
            <Tag color={funcColor.pass}>
              通过{record.ciDate && <span style={{ fontSize: 10, marginLeft: 4, opacity: 0.8 }}>{record.ciDate}</span>}
            </Tag>
          );
        }
        if (status === 'fail') {
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

  const previewColumns: ColumnsType<PreviewRow> = isAscendPreview
    ? [...commonPreviewColumns, ...ascendPreviewColumns]
    : [...commonPreviewColumns, ...kunpengPreviewColumns];

  return (
    <div>
      <Card
        title="JSON 添加软件信息"
        extra={(
          <Space>
            {previewProjects.length > 0 ? (
              <>
                <Button icon={<CloseOutlined />} onClick={handleCancelPreview}>取消</Button>
                <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSavePreview}>
                  保存
                </Button>
              </>
            ) : (
              <>
                <Button icon={<ReloadOutlined />} loading={reloading} onClick={handleReload}>
                  重新加载
                </Button>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleAddPreview}>
                  添加到预览
                </Button>
              </>
            )}
          </Space>
        )}
      >
        <Form layout="vertical">
          <Form.Item label="数据类型">
            <Select
              value={type}
              onChange={handleTypeChange}
              style={{ width: 180 }}
              options={[
                { label: '鲲鹏', value: '鲲鹏' },
                { label: '昇腾', value: '昇腾' },
              ]}
            />
          </Form.Item>
          <Form.Item label="软件 JSON">
            <Input.TextArea
              value={jsonText}
              onChange={event => handleJsonChange(event.target.value)}
              onKeyDown={handleJsonKeyDown}
              rows={22}
              style={{ fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", monospace', fontSize: 12 }}
            />
          </Form.Item>
        </Form>
        <div style={{ padding: 12, marginBottom: 16, border: '1px solid #f0f0f0', borderRadius: 6, background: '#fafafa' }}>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            <Paragraph style={{ marginBottom: 0 }}>
              <Text strong>固定字段可选值：</Text>
              <Text type="secondary">标准 JSON 不支持注释；状态字段可不填或填 null，填写时需使用下方值。openEuler 和 hardware 是可扩展文本，可直接填写新值。</Text>
            </Paragraph>
            {valueGuide.map(item => (
              <div key={item.field} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <Text code>{item.field}</Text>
                <Text type="secondary">共 {item.values.length} 种</Text>
                <Space size={[4, 4]} wrap>
                  {item.values.map(value => (
                    <Tag key={value}>{value}</Tag>
                  ))}
                </Space>
              </div>
            ))}
          </Space>
        </div>
        <Paragraph type="secondary" style={{ marginBottom: 0 }}>
          <Text strong>支持格式：</Text>
          单个 JSON 对象或 JSON 数组。保存后会写入
          {type === '鲲鹏' ? ' src/data/kunpengProjects.json' : ' src/data/ascendProjects.json'}。
        </Paragraph>
      </Card>
      {previewProjects.length > 0 && (
        <Card
          title={`新增预览：${previewType} ${previewProjects.length} 条`}
          style={{ marginTop: 16 }}
        >
          <Table
            size="middle"
            columns={previewColumns}
            dataSource={previewRows}
            rowKey="key"
            pagination={false}
            scroll={isAscendPreview ? undefined : { x: 1600 }}
            expandable={{ defaultExpandAllRows: false, indentSize: 0 }}
            onRow={(record) => {
              if (record.isVersion) return { style: { background: '#f9fafb' } };
              return { style: { cursor: 'pointer' } };
            }}
          />
        </Card>
      )}
    </div>
  );
}
