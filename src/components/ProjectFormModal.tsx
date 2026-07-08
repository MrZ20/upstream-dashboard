import { useEffect } from 'react';
import { Button, Card, DatePicker, Form, Input, Modal, Select, Space, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { Project, ProjectType, VersionInfo } from '../types';
import { useProjects } from '../contexts/ProjectContext';

function splitMultiValue(value?: string) {
  return (value || '')
    .split(';')
    .map(item => item.trim())
    .filter(Boolean);
}

function joinMultiValue(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value.map(item => item.trim()).filter(Boolean).join('; ');
  }
  return splitMultiValue(value).join('; ');
}

function toDateValue(value?: string | null) {
  return value ? dayjs(value) : null;
}

function toDateString(value?: dayjs.Dayjs | null) {
  return value ? value.format('YYYY-MM-DD') : null;
}

function createEmptyVersion() {
  return {
    version: '',
    hardware: [],
    openEuler: [],
    functional: null,
    functionalDate: null,
    performance: null,
    performanceDate: null,
    ci: null,
    ciDate: null,
    integratedDate: dayjs(),
  };
}

function toFormValues(project: Project) {
  return {
    ...project,
    maintainer: {
      name: project.maintainer?.name || '',
      email: project.maintainer?.email || '',
    },
    supportedVersions: project.supportedVersions.length
      ? project.supportedVersions.map(version => ({
          ...version,
          hardware: splitMultiValue(version.hardware),
          openEuler: splitMultiValue(version.openEuler),
          functionalDate: toDateValue(version.functionalDate),
          performanceDate: toDateValue(version.performanceDate),
          ciDate: toDateValue(version.ciDate),
          integratedDate: toDateValue(version.integratedDate),
        }))
      : [createEmptyVersion()],
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  editProject?: Project | null;
  defaultType: ProjectType;
}

export default function ProjectFormModal({ open, onClose, editProject, defaultType }: Props) {
  const { dispatch } = useProjects();
  const [form] = Form.useForm();
  const isEdit = !!editProject;
  const selectedType = Form.useWatch('type', form) || editProject?.type || defaultType;
  const isAscend = selectedType === '昇腾';

  useEffect(() => {
    if (!open) return;

    if (editProject) {
      form.setFieldsValue(toFormValues(editProject));
      return;
    }

    form.resetFields();
    form.setFieldsValue({
      type: defaultType,
      branch: 'main',
      maintainer: { name: '', email: '' },
      supportedVersions: [createEmptyVersion()],
    });
  }, [open, editProject, defaultType, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    const maintainerName = values.maintainer?.name?.trim();
    const maintainerEmail = values.maintainer?.email?.trim();
    if ((maintainerName && !maintainerEmail) || (!maintainerName && maintainerEmail)) {
      message.error('维护者姓名和邮箱需要同时填写');
      return;
    }
    const maintainer = maintainerName && maintainerEmail
      ? {
          name: maintainerName,
          email: maintainerEmail,
        }
      : undefined;
    const supportedVersions: VersionInfo[] = (values.supportedVersions || []).map((version: any) => {
      const base = {
        version: version.version,
        hardware: joinMultiValue(version.hardware),
        integratedDate: toDateString(version.integratedDate) || dayjs().format('YYYY-MM-DD'),
      };

      return values.type === '昇腾'
        ? {
            ...base,
            ci: version.ci || null,
            ciDate: toDateString(version.ciDate),
          }
        : {
            ...base,
            openEuler: joinMultiValue(version.openEuler),
            functional: version.functional || null,
            functionalDate: toDateString(version.functionalDate),
            performance: version.performance || null,
            performanceDate: toDateString(version.performanceDate),
          };
    });

    const data = values.type === '鲲鹏'
      ? {
          name: values.name,
          type: values.type,
          category: values.category,
          latestVersion: values.latestVersion || '',
          upstream: values.upstream || '',
          maintainer,
          supportedVersions,
        }
      : {
          name: values.name,
          type: values.type,
          category: values.category,
          branch: values.branch || 'main',
          upstream: values.upstream || '',
          maintainer,
          supportedVersions,
        };

    if (isEdit) {
      await dispatch({ type: 'UPDATE_PROJECT', payload: { id: editProject!.id, data } });
      message.success(`已更新项目「${values.name}」`);
    } else {
      await dispatch({ type: 'ADD_PROJECT', payload: data });
      message.success(`已新增项目「${values.name}」`);
    }
    onClose();
  };

  return (
    <Modal
      title={isEdit ? '编辑项目' : '新增项目'}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText="保存"
      cancelText="取消"
      width={960}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        style={{ marginTop: 16 }}
        onValuesChange={(changedValues) => {
          if (changedValues.type) {
            form.setFieldsValue({
              branch: changedValues.type === '昇腾' ? 'main' : undefined,
              supportedVersions: [createEmptyVersion()],
            });
          }
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 160px 1.4fr', gap: 16 }}>
          <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
            <Input placeholder="如：Glibc" />
          </Form.Item>
          <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select options={[{ label: '鲲鹏', value: '鲲鹏' }, { label: '昇腾', value: '昇腾' }]} disabled={isEdit} />
          </Form.Item>
          <Form.Item name="category" label="分类" rules={[{ required: true, message: '请输入分类' }]}>
            <Input placeholder="如：基础库&加速库" />
          </Form.Item>
        </div>

        {isAscend ? (
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
            <Form.Item name="branch" label="看护分支">
              <Input placeholder="默认 main" />
            </Form.Item>
            <Form.Item name="upstream" label="上游地址（可选）">
              <Input placeholder="如：https://github.com/example/project" />
            </Form.Item>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16 }}>
            <Form.Item name="latestVersion" label="上游最新版本">
              <Input placeholder="如：2.38" />
            </Form.Item>
            <Form.Item name="upstream" label="上游地址">
              <Input placeholder="如：https://github.com/bminor/glibc" />
            </Form.Item>
          </div>
        )}

        <Card size="small" title="维护者" style={{ marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 16 }}>
            <Form.Item name={["maintainer", "name"]} label="姓名">
              <Input placeholder="如：张三" />
            </Form.Item>
            <Form.Item name={["maintainer", "email"]} label="邮箱" rules={[{ type: 'email', message: '请输入有效邮箱' }]}>
              <Input placeholder="如：zhangsan@example.com" />
            </Form.Item>
          </div>
        </Card>

        <Form.List name="supportedVersions" rules={[{
          validator: async (_, supportedVersions) => {
            if (!supportedVersions || supportedVersions.length < 1) throw new Error('至少需要 1 个版本');
          },
        }]}
        >
          {(fields, { add, remove }, { errors }) => (
            <Card
              size="small"
              title="版本信息"
              extra={(
                <Button size="small" icon={<PlusOutlined />} onClick={() => add(createEmptyVersion())}>
                  新增版本
                </Button>
              )}
            >
              {fields.map((field, index) => (
                <Card
                  key={field.key}
                  size="small"
                  title={`版本 ${index + 1}`}
                  style={{ marginBottom: 12 }}
                  extra={fields.length > 1 && (
                    <Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={() => remove(field.name)}>
                      删除
                    </Button>
                  )}
                >
                  <Space align="start" size={16} wrap style={{ width: '100%' }}>
                    <Form.Item name={[field.name, 'version']} label="支持版本号" rules={[{ required: true, message: '请输入版本号' }]} style={{ width: 180 }}>
                      <Input placeholder="如：2.38" />
                    </Form.Item>
                    <Form.Item name={[field.name, 'hardware']} label="硬件型号" rules={[{ required: true, message: '请输入硬件型号' }]} style={{ width: 260 }}>
                      <Select
                        mode="tags"
                        tokenSeparators={[';']}
                        placeholder="可输入多个，使用分号分隔"
                        options={(isAscend
                          ? ['Ascend 910B', 'Ascend 910C', 'Ascend 310P', 'Ascend 910', 'Ascend 910 Pro']
                          : ['Kunpeng 920', 'Kunpeng 920B', 'Kunpeng 920C', 'Kunpeng 916', 'Kunpeng 930']
                        ).map(value => ({ label: value, value }))}
                      />
                    </Form.Item>
                    <Form.Item name={[field.name, 'integratedDate']} label="集成日期" rules={[{ required: true, message: '请选择集成日期' }]} style={{ width: 180 }}>
                      <DatePicker style={{ width: '100%' }} />
                    </Form.Item>
                  </Space>

                  {isAscend ? (
                    <Space align="start" size={16} wrap style={{ width: '100%' }}>
                      <Form.Item name={[field.name, 'ci']} label="CI验证结果" style={{ width: 180 }}>
                        <Select allowClear placeholder="未测试" options={[
                          { label: '通过', value: 'pass' }, { label: '不通过', value: 'fail' },
                        ]} />
                      </Form.Item>
                      <Form.Item name={[field.name, 'ciDate']} label="CI验证日期" style={{ width: 180 }}>
                        <DatePicker style={{ width: '100%' }} placeholder="选择CI日期" />
                      </Form.Item>
                    </Space>
                  ) : (
                    <>
                      <Form.Item name={[field.name, 'openEuler']} label="openEuler 版本" rules={[{ required: true, message: '请输入 openEuler 版本' }]}>
                        <Select
                          mode="tags"
                          tokenSeparators={[';']}
                          placeholder="可输入多个，使用分号分隔"
                          options={[
                            'openEuler 22.03 LTS', 'openEuler 22.03 LTS SP1', 'openEuler 22.03 LTS SP2',
                            'openEuler 22.03 LTS SP3', 'openEuler 24.03 LTS',
                          ].map(value => ({ label: value, value }))}
                        />
                      </Form.Item>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        <div>
                          <Form.Item name={[field.name, 'functional']} label="功能测试">
                            <Select allowClear placeholder="未测试" options={[
                              { label: '通过', value: 'pass' }, { label: '不通过', value: 'fail' },
                            ]} />
                          </Form.Item>
                          <Form.Item name={[field.name, 'functionalDate']} label="功能测试日期">
                            <DatePicker style={{ width: '100%' }} placeholder="选择测试日期" />
                          </Form.Item>
                        </div>
                        <div>
                          <Form.Item name={[field.name, 'performance']} label="性能测试">
                            <Select allowClear placeholder="未测试" options={[
                              { label: '提升', value: 'improvement' }, { label: '持平', value: 'stable' }, { label: '回退', value: 'regression' },
                            ]} />
                          </Form.Item>
                          <Form.Item name={[field.name, 'performanceDate']} label="性能测试日期">
                            <DatePicker style={{ width: '100%' }} placeholder="选择测试日期" />
                          </Form.Item>
                        </div>
                      </div>
                    </>
                  )}
                </Card>
              ))}
              <Form.ErrorList errors={errors} />
            </Card>
          )}
        </Form.List>
      </Form>
    </Modal>
  );
}
