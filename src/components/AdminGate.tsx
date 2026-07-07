import { useState } from 'react';
import { Modal, Input, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

export default function AdminGate({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login } = useAuth();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleOk = () => {
    setLoading(true);
    setTimeout(() => {
      const ok = login(password);
      setLoading(false);
      if (ok) {
        message.success('已切换到管理模式');
        setPassword('');
        onClose();
      } else {
        message.error('密码错误');
      }
    }, 300);
  };

  return (
    <Modal
      title={<span><LockOutlined style={{ marginRight: 8 }} />管理员验证</span>}
      open={open}
      onOk={handleOk}
      onCancel={() => { setPassword(''); onClose(); }}
      confirmLoading={loading}
      okText="验证"
      cancelText="取消"
    >
      <Input.Password
        placeholder="请输入管理密码"
        value={password}
        onChange={e => setPassword(e.target.value)}
        onPressEnter={handleOk}
        autoFocus
      />
    </Modal>
  );
}
