import { useState, type KeyboardEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Button, Card, Form, Input, message, Modal, Select, Space, Table, Tabs, Tag, Typography } from 'antd';
import { CloseOutlined, CopyOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useProjects } from '../contexts/ProjectContext';
import { OperationLog, Project, ProjectType, VersionInfo } from '../types';
import ProjectTable from '../components/ProjectTable';

const { Text, Paragraph } = Typography;

function getActionMeta(action: OperationLog['action']) {
  if (action === 'add') return { label: '新增', color: 'green' };
  if (action === 'update') return { label: '修改', color: 'blue' };
  return { label: '删除', color: 'red' };
}


function stringifyLogSnapshot(snapshot?: Project | null) {
  return snapshot ? JSON.stringify(snapshot, null, 2) : '无';
}

type DiffLine = {
  type: 'same' | 'added' | 'removed';
  text: string;
};

function buildJsonDiff(beforeText: string, afterText: string): DiffLine[] {
  if (beforeText === afterText) {
    return beforeText.split('\n').map(line => ({ type: 'same', text: line }));
  }

  const beforeLines = beforeText === '无' ? [] : beforeText.split('\n');
  const afterLines = afterText === '无' ? [] : afterText.split('\n');
  const dp = Array.from({ length: beforeLines.length + 1 }, () => Array(afterLines.length + 1).fill(0));

  for (let i = beforeLines.length - 1; i >= 0; i -= 1) {
    for (let j = afterLines.length - 1; j >= 0; j -= 1) {
      dp[i][j] = beforeLines[i] === afterLines[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const result: DiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < beforeLines.length && j < afterLines.length) {
    if (beforeLines[i] === afterLines[j]) {
      result.push({ type: 'same', text: beforeLines[i] });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      result.push({ type: 'removed', text: beforeLines[i] });
      i += 1;
    } else {
      result.push({ type: 'added', text: afterLines[j] });
      j += 1;
    }
  }

  while (i < beforeLines.length) {
    result.push({ type: 'removed', text: beforeLines[i] });
    i += 1;
  }

  while (j < afterLines.length) {
    result.push({ type: 'added', text: afterLines[j] });
    j += 1;
  }

  return result;
}

function getDiffLineStyle(type: DiffLine['type']) {
  if (type === 'added') {
    return { background: '#f6ffed', color: '#237804' };
  }

  if (type === 'removed') {
    return { background: '#fff1f0', color: '#a8071a' };
  }

  return { background: 'transparent', color: '#262626' };
}

function formatLogTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

type PreviewProject = Project;

function splitMultiValue(value?: string) {
  return (value || '')
    .split(';')
    .map(item => item.trim())
    .filter(Boolean);
}

function joinUniqueValues(values: Array<string | undefined>) {
  return [...new Set(values.flatMap(splitMultiValue))].join('; ');
}

function latestDate(values: Array<string | null | undefined>) {
  const sorted = values.filter(Boolean).sort();
  return sorted.length ? sorted[sorted.length - 1] : null;
}

function mergeAscendVersions(supportedVersions: NonNullable<Partial<Project>['supportedVersions']>) {
  if (!supportedVersions.length) return [];

  const base = supportedVersions[0];
  const targetCi: VersionInfo['ci'] = supportedVersions.some(version => version.ci === 'fail')
    ? 'fail'
    : supportedVersions.some(version => version.ci === 'pass')
      ? 'pass'
      : null;
  const targetDates = supportedVersions
    .filter(version => targetCi == null || version.ci === targetCi)
    .map(version => version.ciDate);

  return [{
    ...base,
    hardware: joinUniqueValues(supportedVersions.map(version => version.hardware)),
    ci: targetCi,
    ciDate: latestDate(targetDates),
  }];
}

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
  latestVersion: '1.2.3',
  maintainer: {
    name: 'zhangsan',
    email: 'zhangsan@example.com',
  },
  supportedVersions: [
    {
      version: '1.0.0',
      openEuler: 'openEuler 24.03 LTS; openEuler 22.03 LTS SP3',
      hardware: 'Kunpeng 930; Kunpeng 920B',
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
  upstream: 'https://github.com/example/example-ai',
  maintainer: {
    name: 'lisi',
    email: 'lisi@example.com',
  },
  supportedVersions: [
    {
      version: '1.0.0',
      hardware: 'Ascend 910B; Ascend 910C; Ascend 310P',
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
        latestVersion: input.latestVersion || '',
        maintainer: input.maintainer,
        supportedVersions: input.supportedVersions || [],
      }
    : {
        name: input.name,
        type,
        category: input.category,
        branch: input.branch || 'main',
        upstream: input.upstream || '',
        maintainer: input.maintainer,
        supportedVersions: mergeAscendVersions(input.supportedVersions || []),
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
  if (!input.supportedVersions) return;
  if (!Array.isArray(input.supportedVersions)) {
    throw new Error('supportedVersions 必须是数组');
  }

  input.supportedVersions.forEach((version, index) => {
    const prefix = `supportedVersions[${index}]`;
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
  const [activeTab, setActiveTab] = useState('json');
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<OperationLog | null>(null);
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


  const loadLogs = async () => {
    setLogsLoading(true);
    try {
      const response = await fetch('/api/operation-logs');
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || '日志加载失败');
      }
      const data = await response.json();
      setLogs(Array.isArray(data.logs) ? data.logs : []);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '日志加载失败');
    } finally {
      setLogsLoading(false);
    }
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key === 'logs') void loadLogs();
  };


  const handleCopyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      message.success(`已复制${label}`);
    } catch {
      message.error('复制失败');
    }
  };

  const renderSnapshotBlock = (title: string, value: string) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text strong>{title}</Text>
        <Button size="small" icon={<CopyOutlined />} onClick={() => handleCopyText(title, value)}>
          复制
        </Button>
      </div>
      <pre style={{
        margin: 0,
        padding: 12,
        maxHeight: 280,
        overflow: 'auto',
        border: '1px solid #f0f0f0',
        borderRadius: 6,
        background: '#fafafa',
        fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", monospace',
        fontSize: 12,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {value}
      </pre>
    </div>
  );

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
      const previewItems = normalizedItems.map((project, index) => ({
        ...project,
        id: -Date.now() - index,
      }));

      setPreviewType(type);
      setPreviewProjects(previewItems);
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
        const { id: _previewId, ...projectData } = project;
        await dispatch({ type: 'ADD_PROJECT', payload: projectData });
      }

      message.success(`已保存 ${previewProjects.length} 条${previewType}软件信息`);
      setPreviewProjects([]);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const previewHiddenColumnKeys = previewType === '昇腾' ? ['validationOverview'] : [];

  const logColumns = [
    {
      title: '修改时间',
      dataIndex: 'time',
      width: 180,
      render: (value: string) => formatLogTime(value),
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 90,
      render: (action: OperationLog['action']) => {
        const meta = getActionMeta(action);
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '类型',
      dataIndex: 'projectType',
      width: 90,
      render: (value: ProjectType) => <Tag color={value === '鲲鹏' ? 'blue' : 'cyan'}>{value}</Tag>,
    },
    {
      title: '软件名称',
      dataIndex: 'projectName',
      width: 180,
      ellipsis: true,
    },
    {
      title: '摘要',
      dataIndex: 'summary',
      ellipsis: true,
    },
    {
      title: '详情',
      key: 'detail',
      width: 90,
      align: 'center' as const,
      render: (_: unknown, record: OperationLog) => (
        <Button type="link" size="small" onClick={() => setSelectedLog(record)}>查看</Button>
      ),
    },
  ];

  const jsonAddPanel = (
    <>
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
              <Text type="secondary">标准 JSON 不支持注释；状态字段可不填或填 null，填写时需使用下方值。openEuler 和 hardware 是可扩展文本，可直接填写新值；同一字段多个值用英文分号 ; 分隔。</Text>
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
          <ProjectTable
            projects={previewProjects}
            projectType={previewType}
            hiddenColumnKeys={previewHiddenColumnKeys}
            pagination={false}
          />
        </Card>
      )}
    </>
  );

  const logsPanel = (
    <Card
      title="日志信息"
      extra={<Button icon={<ReloadOutlined />} loading={logsLoading} onClick={loadLogs}>刷新日志</Button>}
    >
      <Table
        rowKey="id"
        size="small"
        loading={logsLoading}
        columns={logColumns}
        dataSource={logs}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        locale={{ emptyText: '暂无操作日志' }}
      />
    </Card>
  );

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={[
          { key: 'json', label: 'JSON 添加软件信息', children: jsonAddPanel },
          { key: 'logs', label: '操作日志', children: logsPanel },
        ]}
      />
      <Modal
        title={selectedLog ? `操作详情：${getActionMeta(selectedLog.action).label} ${selectedLog.projectName}` : '操作详情'}
        open={selectedLog != null}
        onCancel={() => setSelectedLog(null)}
        footer={null}
        width={960}
      >
        {selectedLog && (() => {
          const beforeText = stringifyLogSnapshot(selectedLog.before);
          const afterText = stringifyLogSnapshot(selectedLog.after);
          const diffLines = buildJsonDiff(beforeText, afterText);

          return (
            <Space direction="vertical" size={12} style={{ width: '100%' }}>
              <Space size={[8, 8]} wrap>
                <Tag color={getActionMeta(selectedLog.action).color}>{getActionMeta(selectedLog.action).label}</Tag>
                <Tag>{selectedLog.projectType}</Tag>
                <Text strong>{selectedLog.projectName}</Text>
                <Text type="secondary">ID: {selectedLog.projectId}</Text>
                <Text type="secondary">{formatLogTime(selectedLog.time)}</Text>
              </Space>
              <Paragraph style={{ marginBottom: 0 }}>{selectedLog.summary}</Paragraph>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text strong>颜色对比</Text>
                  <Space size={8}>
                    <Tag color="red">删除</Tag>
                    <Tag color="green">新增</Tag>
                  </Space>
                </div>
                <pre style={{
                  margin: 0,
                  padding: 0,
                  maxHeight: 320,
                  overflow: 'auto',
                  border: '1px solid #f0f0f0',
                  borderRadius: 6,
                  background: '#fff',
                  fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", monospace',
                  fontSize: 12,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {diffLines.map((line, index) => (
                    <div
                      key={`${line.type}-${index}-${line.text}`}
                      style={{ padding: '0 12px', minHeight: 20, ...getDiffLineStyle(line.type) }}
                    >
                      <span style={{ display: 'inline-block', width: 18 }}>
                        {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                      </span>
                      {line.text || ' '}
                    </div>
                  ))}
                </pre>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
                {renderSnapshotBlock('修改前', beforeText)}
                {renderSnapshotBlock('修改后', afterText)}
              </div>
            </Space>
          );
        })()}
      </Modal>
    </div>
  );
}
