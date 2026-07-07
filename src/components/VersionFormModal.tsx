import { useEffect } from 'react';
import { Modal, Form, Input, Select, DatePicker, message } from 'antd';
import dayjs from 'dayjs';
import { VersionInfo } from '../types';
import { useProjects } from '../contexts/ProjectContext';

interface Props {
  open: boolean;
  onClose: () => void;
  projectId: number;
  editVersion?: VersionInfo | null;
  versionIndex?: number;
}

export default function VersionFormModal({ open, onClose, projectId, editVersion, versionIndex }: Props) {
  const { projects, dispatch } = useProjects();
  const [form] = Form.useForm();
  const isEdit = editVersion != null;
  const project = projects.find(p => p.id === projectId);
  const isAscend = project?.type === '昇腾';

  useEffect(() => {
    if (open) {
      if (editVersion) {
        form.setFieldsValue({
          version: editVersion.version,
          openEuler: editVersion.openEuler,
          hardware: editVersion.hardware,
          functional: editVersion.functional,
          performance: editVersion.performance,
          ci: editVersion.ci,
          integratedDate: dayjs(editVersion.integratedDate),
          functionalDate: editVersion.functionalDate ? dayjs(editVersion.functionalDate) : null,
          performanceDate: editVersion.performanceDate ? dayjs(editVersion.performanceDate) : null,
          ciDate: editVersion.ciDate ? dayjs(editVersion.ciDate) : null,
        });
      } else {
        form.resetFields();
        form.setFieldsValue({ integratedDate: dayjs() });
      }
    }
  }, [open, editVersion, form]);

  const handleOk = async () => {
    const values = await form.validateFields();
    const base = {
      version: values.version,
      hardware: values.hardware,
      integratedDate: values.integratedDate.format('YYYY-MM-DD'),
    };
    const version: VersionInfo = isAscend
      ? {
          ...base,
          ci: values.ci || null,
          ciDate: values.ciDate ? values.ciDate.format('YYYY-MM-DD') : null,
        }
      : {
          ...base,
          openEuler: values.openEuler,
          functional: values.functional || null,
          functionalDate: values.functionalDate ? values.functionalDate.format('YYYY-MM-DD') : null,
          performance: values.performance || null,
          performanceDate: values.performanceDate ? values.performanceDate.format('YYYY-MM-DD') : null,
    };

    if (isEdit && versionIndex != null) {
      await dispatch({ type: 'UPDATE_VERSION', payload: { projectId, versionIndex, version } });
      message.success('已更新版本信息');
    } else {
      await dispatch({ type: 'ADD_VERSION', payload: { projectId, version } });
      message.success('已新增版本');
    }
    onClose();
  };

  return (
    <Modal
      title={isEdit ? '编辑版本' : '新增版本'}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      okText="保存"
      cancelText="取消"
      width={560}
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="version" label="支持版本号" rules={[{ required: true, message: '请输入' }]}>
          <Input placeholder="如：2.38" />
        </Form.Item>
        <Form.Item name="hardware" label="硬件型号" rules={[{ required: true }]}>
          <Select options={(isAscend
            ? ['Ascend 910B', 'Ascend 910C', 'Ascend 310P', 'Ascend 910', 'Ascend 910 Pro']
            : ['Kunpeng 920', 'Kunpeng 920B', 'Kunpeng 920C', 'Kunpeng 916', 'Kunpeng 930']
          ).map(v => ({ label: v, value: v }))} />
        </Form.Item>
        {isAscend ? (
          <>
            <Form.Item name="ci" label="CI验证结果">
              <Select allowClear placeholder="未测试" options={[
                { label: '通过', value: 'pass' }, { label: '不通过', value: 'fail' },
              ]} />
            </Form.Item>
            <Form.Item name="ciDate" label="CI验证日期">
              <DatePicker style={{ width: '100%' }} placeholder="选择CI日期" />
            </Form.Item>
          </>
        ) : (
          <>
            <Form.Item name="openEuler" label="openEuler 版本" rules={[{ required: true }]}>
              <Select options={[
                'openEuler 22.03 LTS', 'openEuler 22.03 LTS SP1', 'openEuler 22.03 LTS SP2',
                'openEuler 22.03 LTS SP3', 'openEuler 24.03 LTS',
              ].map(v => ({ label: v, value: v }))} />
            </Form.Item>
            <Form.Item name="functional" label="功能测试">
              <Select allowClear placeholder="未测试" options={[
                { label: '通过', value: 'pass' }, { label: '不通过', value: 'fail' },
              ]} />
            </Form.Item>
            <Form.Item name="functionalDate" label="功能测试日期">
              <DatePicker style={{ width: '100%' }} placeholder="选择测试日期" />
            </Form.Item>
            <Form.Item name="performance" label="性能测试 (与上一版本对比)">
              <Select allowClear placeholder="未测试" options={[
                { label: '提升', value: 'improvement' }, { label: '持平', value: 'stable' }, { label: '回退', value: 'regression' },
              ]} />
            </Form.Item>
            <Form.Item name="performanceDate" label="性能测试日期">
              <DatePicker style={{ width: '100%' }} placeholder="选择测试日期" />
            </Form.Item>
          </>
        )}
        <Form.Item name="integratedDate" label="集成日期" rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
