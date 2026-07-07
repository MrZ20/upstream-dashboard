import { useEffect } from 'react';
import { Modal, Form, Input, Button, message, Space } from 'antd';
import { Project } from '../types';
import { useProjects } from '../contexts/ProjectContext';

export default function MaintainerModal({ open, onClose, project }: { open: boolean; onClose: () => void; project?: Project | null }) {
  const { dispatch } = useProjects();
  const [form] = Form.useForm();

  useEffect(() => {
    if (open && project) {
      form.setFieldsValue({
        name: project.maintainer?.name || '',
        email: project.maintainer?.email || '',
      });
    }
  }, [open, project, form]);

  const handleSave = async () => {
    if (!project) return;
    const values = await form.validateFields();
    await dispatch({ type: 'SET_MAINTAINER', payload: { id: project.id, maintainer: { name: values.name, email: values.email } } });
    message.success('已保存维护者信息');
    onClose();
  };

  const handleRemove = async () => {
    if (!project) return;
    await dispatch({ type: 'SET_MAINTAINER', payload: { id: project.id, maintainer: null } });
    message.success('已移除维护者');
    onClose();
  };

  return (
    <Modal
      title={project ? `维护者配置 — ${project.name}` : '维护者配置'}
      open={open}
      onCancel={onClose}
      footer={null}
      width={460}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入维护者姓名' }]}>
          <Input placeholder="如：张三" />
        </Form.Item>
        <Form.Item name="email" label="邮箱" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
          <Input placeholder="如：zhangsan@example.com" />
        </Form.Item>
      </Form>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        {project?.maintainer && (
          <Button danger onClick={handleRemove}>移除维护者</Button>
        )}
        <Button type="primary" onClick={handleSave}>保存</Button>
      </div>
    </Modal>
  );
}
