import type { CSSProperties } from 'react';
import { Space, Tag, Tooltip } from 'antd';
import { Project } from '../../domain/projectTypes';
import {
  getValidationOverview,
  isLongText,
  splitMultiValue,
  truncateText,
} from '../../domain/projectFormat';
import type { ProjectTableRow } from './tableRows';

const textEllipsisThreshold = 28;

interface ProjectTableRenderersOptions {
  nameColumnWidth: number;
  validationOverviewVisible: boolean;
}

export function createProjectTableRenderers({
  nameColumnWidth,
  validationOverviewVisible,
}: ProjectTableRenderersOptions) {
  const renderProjectName = (name: string, record: ProjectTableRow) => {
    const overviewWidth = validationOverviewVisible ? 72 : 0;
    const maxWidth = Math.max(80, nameColumnWidth - overviewWidth);
    const node = record.upstream ? (
      <a
        className="truncated-text project-name-text"
        style={{ maxWidth, fontWeight: 600 }}
        href={record.upstream}
        target="_blank"
        rel="noopener noreferrer"
      >
        {name}
      </a>
    ) : (
      <span
        className="truncated-text project-name-text"
        style={{ maxWidth, fontWeight: 600 }}
      >
        {name}
      </span>
    );

    return isLongText(name) ? <Tooltip title={name}>{node}</Tooltip> : node;
  };

  const renderValidationOverview = (project: Project) => {
    const overview = getValidationOverview(project);
    const label = project.type === '昇腾' ? 'CI验证' : '功能+性能';

    return (
      <span className="validation-overview">
        <Tooltip title={`${label}: ${overview.goodCount}/${overview.total}`}>
          <span
            className="validation-overview-block"
            style={{
              backgroundColor: overview.color,
              color: overview.textColor,
            }}
          >
            {overview.goodCount}/{overview.total}
          </span>
        </Tooltip>
      </span>
    );
  };

  const renderTextTag = (
    value?: string,
    color?: string,
    maxLength = textEllipsisThreshold,
    style?: CSSProperties,
  ) => {
    if (!value) return null;
    const tag = (
      <Tag color={color} className="truncated-tag" style={{ maxWidth: 140, ...style }}>
        {truncateText(value, maxLength)}
      </Tag>
    );
    return isLongText(value, maxLength) ? <Tooltip title={value}>{tag}</Tooltip> : tag;
  };

  const renderMultiTextTags = (
    value?: string,
    color?: string,
    maxLength = textEllipsisThreshold,
    style?: CSSProperties,
  ) => {
    const items = splitMultiValue(value);
    if (!items.length) return null;
    return (
      <Space size={[4, 4]} wrap>
        {items.map((item, index) => (
          <span key={`${item}-${index}`}>
            {renderTextTag(item, color, maxLength, style)}
          </span>
        ))}
      </Space>
    );
  };

  const renderVersionTag = (version?: string, extra = '') => {
    if (!version) return null;
    const label = `v${version}`;
    const tag = (
      <Tag
        className="truncated-tag version-tag"
        style={{ maxWidth: 120 }}
      >
        {truncateText(label, 18)}
        {extra && <span style={{ color: '#999', fontSize: 11 }}>{extra}</span>}
      </Tag>
    );
    return isLongText(label, 18) ? <Tooltip title={`${label}${extra}`}>{tag}</Tooltip> : tag;
  };

  return {
    renderMultiTextTags,
    renderProjectName,
    renderTextTag,
    renderValidationOverview,
    renderVersionTag,
  };
}
