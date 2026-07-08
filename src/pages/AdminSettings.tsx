import { useState, type KeyboardEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Button, Card, Form, Input, message, Select, Space, Tag, Typography } from 'antd';
import { CloseOutlined, PlusOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import { useProjects } from '../contexts/ProjectContext';
import { Project, ProjectType, VersionInfo } from '../types';
import ProjectTable from '../components/ProjectTable';

const { Text, Paragraph } = Typography;

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
    </div>
  );
}
