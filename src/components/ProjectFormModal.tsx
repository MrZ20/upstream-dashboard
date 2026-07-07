import { useEffect } from 'react';
import { Modal, Form, Input, Select, message } from 'antd';
import { Project, ProjectType } from '../types';
import { useProjects } from '../contexts/ProjectContext';

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

  useEffect(() => {
    if (open) {
      if (editProject) {
        form.setFieldsValue(editProject);
      } else {
        form.resetFields();
        form.setFieldsValue({ type: defaultType });
      }
    }
  }, [open, editProject, defaultType, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    const data = values.type === '鲲鹏'
      ? {
          name: values.name,
          type: values.type,
          category: values.category,
          upstreamVersion: values.upstreamVersion || '',
          upstream: values.upstream || '',
        }
      : {
          name: values.name,
          type: values.type,
          category: values.category,
          branch: values.branch || 'main',
    };

    if (isEdit) {
      await dispatch({ type: 'UPDATE_PROJECT', payload: { id: editProject!.id, data } });
      message.success(`已更新项目「${values.name}」`);
    } else {
      await dispatch({ type: 'ADD_PROJECT', payload: { ...data, maintainer: undefined, versions: [] } });
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
      width={560}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="name" label="项目名称" rules={[{ required: true, message: '请输入项目名称' }]}>
          <Input placeholder="如：Glibc" />
        </Form.Item>
        <Form.Item name="type" label="类型" rules={[{ required: true, message: '请选择类型' }]}>
          <Select options={[{ label: '鲲鹏', value: '鲲鹏' }, { label: '昇腾', value: '昇腾' }]} />
        </Form.Item>
        <Form.Item name="category" label="分类" rules={[{ required: true, message: '请输入分类' }]}>
          <Input placeholder="如：基础库&加速库" />
        </Form.Item>
        {selectedType === '昇腾' ? (
          <Form.Item name="branch" label="看护分支">
            <Input placeholder="默认 main" />
          </Form.Item>
        ) : (
          <>
            <Form.Item name="upstreamVersion" label="上游最新版本">
              <Input placeholder="如：2.38" />
            </Form.Item>
            <Form.Item name="upstream" label="上游地址">
              <Input placeholder="如：https://github.com/bminor/glibc" />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
}
