import { App, Tag, Tooltip } from 'antd';
import { CopyOutlined, UserOutlined } from '@ant-design/icons';
import type { MouseEvent } from 'react';
import { Maintainer } from '../../domain/projectTypes';

function formatMaintainer(maintainer: Maintainer) {
  return `${maintainer.name} <${maintainer.email}>`;
}

async function copyText(text: string) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  textarea.setAttribute('readonly', '');
  document.body.appendChild(textarea);
  textarea.focus({ preventScroll: true });
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!copied) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    throw new Error('Copy command was not accepted');
  }
}

export default function MaintainerTag({ maintainer }: { maintainer: Maintainer }) {
  const { message } = App.useApp();
  const copyValue = formatMaintainer(maintainer);

  const handleCopy = async (event: MouseEvent<HTMLElement>) => {
    event.stopPropagation();

    try {
      await copyText(copyValue);
      message.success('已复制维护者信息');
    } catch {
      message.error('复制失败');
    }
  };

  return (
    <Tooltip
      title={(
        <div>
          <div>维护者: {maintainer.name}</div>
          <div>邮箱: {maintainer.email}</div>
          <div style={{ opacity: 0.75, fontSize: 12, marginTop: 4 }}>点击标签复制</div>
        </div>
      )}
    >
      <Tag
        color="blue"
        onClick={handleCopy}
        onMouseDown={event => event.stopPropagation()}
        role="button"
        tabIndex={0}
        title={copyValue}
        aria-label={`复制维护者信息: ${copyValue}`}
        style={{ fontSize: 11, cursor: 'pointer', userSelect: 'none' }}
      >
        <UserOutlined /> {maintainer.name} <CopyOutlined />
      </Tag>
    </Tooltip>
  );
}
