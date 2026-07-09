import { Project, VersionInfo } from './projectTypes';

export const funcColor: Record<string, string> = { pass: 'green', fail: 'red' };
export const funcText: Record<string, string> = { pass: '通过', fail: '不通过' };
export const perfColor: Record<string, string> = { improvement: 'green', stable: 'blue', regression: 'red' };
export const perfText: Record<string, string> = { improvement: '提升', stable: '持平', regression: '回退' };

const validationOverviewColors = {
  green: '#E7FAF4',
  yellow: '#FFF3D6',
  red: '#FFE7E7',
  neutral: '#F5F5F5',
};
const validationOverviewTextColors = {
  green: '#008767',
  yellow: '#B45309',
  red: '#D0004B',
  neutral: '#9197B3',
};


export function isLongText(text: string, maxLength = 28) {
  return text.length > maxLength;
}

export function truncateText(text: string, maxLength = 28) {
  if (!isLongText(text, maxLength)) return text;
  return `${text.slice(0, maxLength)}...`;
}

export function splitMultiValue(value?: string) {
  return (value || '')
    .split(';')
    .map(item => item.trim())
    .filter(Boolean);
}

export function joinUniqueValues(values: Array<string | undefined>) {
  return [...new Set(values.flatMap(splitMultiValue))].join('; ');
}

export function latestDate(values: Array<string | null | undefined>) {
  const sorted = values.filter(Boolean).sort();
  return sorted.length ? sorted[sorted.length - 1] : null;
}

function isValidationGood(project: Project, version: VersionInfo) {
  if (project.type === '昇腾') return version.ci === 'pass';
  return version.functional === 'pass'
    && (version.performance === 'improvement' || version.performance === 'stable');
}

export function getValidationOverview(project: Project) {
  const total = project.supportedVersions.length;
  const goodCount = project.supportedVersions.filter(version => isValidationGood(project, version)).length;

  if (!total) {
    return {
      total,
      goodCount,
      color: validationOverviewColors.neutral,
      textColor: validationOverviewTextColors.neutral,
    };
  }

  if (goodCount === total) {
    return {
      total,
      goodCount,
      color: validationOverviewColors.green,
      textColor: validationOverviewTextColors.green,
    };
  }

  if (goodCount > 0) {
    return {
      total,
      goodCount,
      color: validationOverviewColors.yellow,
      textColor: validationOverviewTextColors.yellow,
    };
  }

  return {
    total,
    goodCount,
    color: validationOverviewColors.red,
    textColor: validationOverviewTextColors.red,
  };
}
