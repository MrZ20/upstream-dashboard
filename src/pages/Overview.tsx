import { useMemo, type CSSProperties } from 'react';
import { Row, Col, Card, Statistic, Table, Tag, Button, Tooltip, message } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, CloseCircleOutlined, SendOutlined, UserOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useAuth } from '../contexts/AuthContext';
import { useProjects } from '../contexts/ProjectContext';
import { Project, SummaryStats } from '../types';

function getStats(projects: Project[]): SummaryStats {
  let totalVersions = 0;
  let totalFunctional = 0, functionalPass = 0;
  let totalPerf = 0, perfPass = 0;
  let regressionCount = 0, improvementCount = 0;
  let totalCi = 0, ciPass = 0, ciFail = 0;
  let fullyIntegrated = 0;

  for (const p of projects) {
    totalVersions += p.supportedVersions.length;
    if (p.supportedVersions.length >= 2) fullyIntegrated++;

    const latest = p.supportedVersions[0];
    if (latest) {
      if (latest.functional != null) {
        totalFunctional++;
        if (latest.functional === 'pass') functionalPass++;
      }
      if (latest.performance != null) {
        totalPerf++;
        if (latest.performance !== 'regression') perfPass++;
        if (latest.performance === 'regression') regressionCount++;
        if (latest.performance === 'improvement') improvementCount++;
      }
      if (latest.ci != null) {
        totalCi++;
        if (latest.ci === 'pass') ciPass++;
        if (latest.ci === 'fail') ciFail++;
      }
    }
  }

  return {
    totalProjects: projects.length,
    kunpengCount: 0,
    ascendCount: 0,
    totalVersions,
    functionalPassRate: totalFunctional > 0 ? (functionalPass / totalFunctional) * 100 : 0,
    performancePassRate: totalPerf > 0 ? (perfPass / totalPerf) * 100 : 0,
    regressionCount,
    improvementCount,
    ciPassRate: totalCi > 0 ? (ciPass / totalCi) * 100 : 0,
    ciFailCount: ciFail,
    fullyIntegrated,
  };
}

function getCategoryMap(projects: Project[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const p of projects) {
    map[p.category] = (map[p.category] || 0) + 1;
  }
  return map;
}

export default function Overview() {
  const { isAdmin } = useAuth();
  const { projects } = useProjects();

  const kunpeng = useMemo(() => projects.filter(p => p.type === '鲲鹏'), [projects]);
  const ascend = useMemo(() => projects.filter(p => p.type === '昇腾'), [projects]);

  const kunpengStats = useMemo(() => getStats(kunpeng), [kunpeng]);
  const ascendStats = useMemo(() => getStats(ascend), [ascend]);

  const kunpengCats = useMemo(() => getCategoryMap(kunpeng), [kunpeng]);
  const ascendCats = useMemo(() => getCategoryMap(ascend), [ascend]);

  const knCount = kunpengStats.totalProjects;
  const asCount = ascendStats.totalProjects;

  const kunpengPieOption = {
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
    title: { text: '鲲鹏分类', left: 'center', top: 5, textStyle: { fontSize: 13 } },
    legend: { type: 'scroll' as const, orient: 'vertical', right: 10, top: 30, bottom: 20, textStyle: { fontSize: 10 } },
    series: [{
      type: 'pie', radius: ['40%', '68%'], center: ['35%', '55%'],
      itemStyle: { borderRadius: 3, borderColor: '#fff', borderWidth: 1 },
      label: { show: false },
      data: Object.entries(kunpengCats).map(([name, value]) => ({ name, value })),
    }],
  };

  const ascendPieOption = {
    tooltip: { trigger: 'item' as const, formatter: '{b}: {c} ({d}%)' },
    title: { text: '昇腾分类', left: 'center', top: 5, textStyle: { fontSize: 13 } },
    legend: { type: 'scroll' as const, orient: 'vertical', right: 10, top: 30, bottom: 20, textStyle: { fontSize: 10 } },
    series: [{
      type: 'pie', radius: ['40%', '68%'], center: ['35%', '55%'],
      itemStyle: { borderRadius: 3, borderColor: '#fff', borderWidth: 1 },
      label: { show: false },
      data: Object.entries(ascendCats).map(([name, value]) => ({ name, value })),
    }],
  };

  const riskColumns: any[] = [
    { title: '项目名称', dataIndex: 'name', key: 'name', width: 200, ellipsis: true },
    { title: '类型', dataIndex: 'type', key: 'type', width: 60, render: (t: string) => <Tag color={t === '鲲鹏' ? 'blue' : 'cyan'}>{t}</Tag> },
    { title: '分类', dataIndex: 'category', key: 'cat', width: 110, render: (c: string) => <Tag>{c}</Tag> },
    {
      title: '维护人', dataIndex: 'maintainer', key: 'maintainer', width: 100,
      render: (m: { name: string } | undefined) => m ? <Tag color="green"><UserOutlined /> {m.name}</Tag> : <span style={{ color: '#ccc' }}>未设置</span>,
    },
    { title: '版本', dataIndex: 'version', key: 'ver', width: 100, render: (v: string) => <Tag color="blue">{v}</Tag> },
    {
      title: '异常类型', key: 'issue', width: 160,
      render: (_: unknown, r: { type: string; func: string | null; funcDate: string | null; perfStatus: string | null; perfDate: string | null; ci: string | null; ciDate: string | null }) => {
        if (r.type === '昇腾' && r.ci === 'fail') {
          return <Tag color="red" icon={<CloseCircleOutlined />}>CI不通过{r.ciDate && <span style={{ fontSize: 10, marginLeft: 4 }}>{r.ciDate}</span>}</Tag>;
        }
        return (
          <>
            {r.func === 'fail' && <Tag color="red" icon={<CloseCircleOutlined />}>功能不通过{r.funcDate && <span style={{ fontSize: 10, marginLeft: 4 }}>{r.funcDate}</span>}</Tag>}
            {r.perfStatus === 'regression' && <Tag color="red"><ArrowDownOutlined /> 性能回退{r.perfDate && <span style={{ fontSize: 10, marginLeft: 4 }}>{r.perfDate}</span>}</Tag>}
          </>
        );
      },
    },
  ];

  if (isAdmin) {
    riskColumns.push({
      title: '通知', key: 'notify', width: 80, fixed: 'right' as const,
      render: (_: unknown, r: { name: string; type: string; version: string; maintainer: { name: string; email: string } | undefined }) => (
        <Tooltip title="复制通知文本到剪贴板">
          <Button size="small" type="link" icon={<SendOutlined />} onClick={() => {
            const maintainerInfo = r.maintainer
              ? `收件人: ${r.maintainer.name} <${r.maintainer.email}>`
              : '收件人: (未设置维护者，请尽快配置)';
            const issue = r.type === '昇腾' ? 'CI验证不通过' : '功能/性能异常';
            const text = `[异常预警]\n\n项目: ${r.name} (${r.type})\n版本: ${r.version}\n问题: ${issue}\n${maintainerInfo}\n\n请尽快确认问题根因并修复。`;
            navigator.clipboard.writeText(text).then(() => message.success('已复制通知文本'));
          }}>通知</Button>
        </Tooltip>
      ),
    });
  }

  const riskData = projects.flatMap(p =>
    p.supportedVersions
      .filter(v => {
        if (p.type === '昇腾') return v.ci === 'fail';
        return v.functional === 'fail' || v.performance === 'regression';
      })
      .map(v => ({
        key: `${p.id}-${v.version}`,
        name: p.name,
        type: p.type,
        category: p.category,
        maintainer: p.maintainer,
        version: v.version,
        func: v.functional,
        funcDate: v.functionalDate,
        perfStatus: v.performance,
        perfDate: v.performanceDate,
        ci: v.ci,
        ciDate: v.ciDate,
      })),
  ).slice(0, 20);

  const metricCellStyle: CSSProperties = {
    height: '100%',
    padding: '12px 14px',
    border: '1px solid #eef2f7',
    borderRadius: 6,
    background: '#fafbfc',
  };

  const renderMetric = (
    title: string,
    value: number,
    suffix: string,
    valueStyle?: CSSProperties,
    precision?: number,
    span = 12,
  ) => (
    <Col xs={24} sm={span}>
      <div style={metricCellStyle}>
        <Statistic
          title={title}
          value={value}
          suffix={suffix}
          precision={precision}
          valueStyle={valueStyle}
        />
      </div>
    </Col>
  );

  return (
    <div>
      <Row gutter={[16, 16]}>
        <Col xs={24} xl={12}>
          <Card title="鲲鹏" style={{ borderTop: '3px solid #0066CC', height: '100%' }}>
            <Row gutter={[12, 12]}>
              {renderMetric('项目总数', knCount, '个')}
              {renderMetric(
                '性能通过率',
                kunpengStats.performancePassRate,
                '%',
                { color: kunpengStats.performancePassRate >= 70 ? '#3f8600' : '#cf1322' },
                1,
              )}
              {renderMetric(
                '功能通过率',
                kunpengStats.functionalPassRate,
                '%',
                { color: kunpengStats.functionalPassRate >= 80 ? '#3f8600' : '#cf1322' },
                1,
              )}
              {renderMetric('性能回退', kunpengStats.regressionCount, '个', { color: '#cf1322' })}
            </Row>
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="昇腾" style={{ borderTop: '3px solid #13c2c2', height: '100%' }}>
            <Row gutter={[12, 12]}>
              {renderMetric('项目总数', asCount, '个', undefined, undefined, 24)}
              {renderMetric(
                'CI通过率',
                ascendStats.ciPassRate,
                '%',
                { color: ascendStats.ciPassRate >= 80 ? '#3f8600' : '#cf1322' },
                1,
              )}
              {renderMetric('CI不通过', ascendStats.ciFailCount, '个', { color: '#cf1322' })}
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card style={{ height: 380 }}><ReactECharts option={kunpengPieOption} style={{ height: 340 }} /></Card>
        </Col>
        <Col span={12}>
          <Card style={{ height: 380 }}><ReactECharts option={ascendPieOption} style={{ height: 340 }} /></Card>
        </Col>
      </Row>

      <Row style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="待关注项（功能失败 / 性能回退）">
            <Table columns={riskColumns} dataSource={riskData} pagination={false} size="small" locale={{ emptyText: '无异常项' }} scroll={isAdmin ? { x: 1100 } : undefined} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
