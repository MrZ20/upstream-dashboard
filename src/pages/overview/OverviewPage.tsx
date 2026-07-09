import { useMemo, type CSSProperties } from 'react';
import { Row, Col, Card, Statistic, Table, Tag } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, CloseCircleOutlined, UserOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useProjects } from '../../domain/projectStore';
import { Project } from '../../domain/projectTypes';
import { getCategoryMap, getProjectStats, getRiskItems, type RiskItem } from '../../domain/projectStats';


export default function OverviewPage() {
  const { projects } = useProjects();

  const kunpeng = useMemo(() => projects.filter(p => p.type === '鲲鹏'), [projects]);
  const ascend = useMemo(() => projects.filter(p => p.type === '昇腾'), [projects]);

  const kunpengStats = useMemo(() => getProjectStats(kunpeng), [kunpeng]);
  const ascendStats = useMemo(() => getProjectStats(ascend), [ascend]);

  const kunpengCats = useMemo(() => getCategoryMap(kunpeng), [kunpeng]);
  const ascendCats = useMemo(() => getCategoryMap(ascend), [ascend]);

  const knCount = kunpengStats.totalProjects;
  const asCount = ascendStats.totalProjects;

  const chartColors = ['#5932EA', '#00B087', '#16C098', '#F59E0B', '#DF0404', '#60A5FA', '#A78BFA', '#F472B6', '#94A3B8'];

  const createPieOption = (title: string, data: Record<string, number>) => ({
    color: chartColors,
    tooltip: {
      trigger: 'item' as const,
      formatter: '{b}: {c} ({d}%)',
      backgroundColor: '#ffffff',
      borderColor: '#eeeeee',
      textStyle: { color: '#292d32', fontFamily: 'Poppins' },
    },
    title: {
      text: title,
      left: 22,
      top: 2,
      textStyle: { fontSize: 18, fontWeight: 600, color: '#000000', fontFamily: 'Poppins' },
    },
    legend: {
      type: 'scroll' as const,
      orient: 'vertical',
      right: 14,
      top: 52,
      bottom: 20,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { fontSize: 11, color: '#9197b3', fontFamily: 'Poppins' },
    },
    series: [{
      type: 'pie',
      radius: ['44%', '70%'],
      center: ['35%', '58%'],
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 3 },
      label: { show: false },
      data: Object.entries(data).map(([name, value]) => ({ name, value })),
    }],
  });

  const kunpengPieOption = createPieOption('鲲鹏分类', kunpengCats);
  const ascendPieOption = createPieOption('昇腾分类', ascendCats);

  const riskColumns: any[] = [
    { title: '项目名称', dataIndex: 'name', key: 'name', width: 200, ellipsis: true },
    { title: '类型', dataIndex: 'type', key: 'type', width: 60, render: (t: string) => <Tag color={t === '鲲鹏' ? 'blue' : 'cyan'}>{t}</Tag> },
    { title: '分类', dataIndex: 'category', key: 'cat', width: 110, render: (c: string) => <Tag>{c}</Tag> },
    { title: '版本', dataIndex: 'version', key: 'ver', width: 100, render: (v: string) => <Tag color="blue">{v}</Tag> },
    {
      title: '异常类型', key: 'issue', width: 160,
      render: (_: unknown, r: RiskItem) => {
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
    {
      title: '维护人', dataIndex: 'maintainer', key: 'maintainer', width: 100,
      render: (m: { name: string } | undefined) => m ? <Tag color="green"><UserOutlined /> {m.name}</Tag> : <span style={{ color: '#ccc' }}>未设置</span>,
    },
  ];


  const riskData = useMemo(() => getRiskItems(projects), [projects]);

  const renderMetric = (
    title: string,
    value: number,
    suffix: string,
    valueStyle?: CSSProperties,
    precision?: number,
    span = 12,
  ) => (
    <Col xs={24} sm={span}>
      <div className="metric-cell">
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
    <div className="overview-page">
      <Row gutter={[20, 20]}>
        <Col xs={24} xl={12}>
          <Card title="鲲鹏" className="overview-domain-card overview-domain-card-kunpeng">
            <Row gutter={[12, 12]}>
              {renderMetric('项目总数', knCount, '个')}
              {renderMetric(
                '性能通过率',
                kunpengStats.performancePassRate,
                '%',
                { color: kunpengStats.performancePassRate >= 70 ? '#00AC4F' : '#D0004B' },
                1,
              )}
              {renderMetric(
                '功能通过率',
                kunpengStats.functionalPassRate,
                '%',
                { color: kunpengStats.functionalPassRate >= 80 ? '#00AC4F' : '#D0004B' },
                1,
              )}
              {renderMetric('性能回退', kunpengStats.regressionCount, '个', { color: '#D0004B' })}
            </Row>
          </Card>
        </Col>
        <Col xs={24} xl={12}>
          <Card title="昇腾" className="overview-domain-card overview-domain-card-ascend">
            <Row gutter={[12, 12]}>
              {renderMetric('项目总数', asCount, '个', undefined, undefined, 24)}
              {renderMetric(
                'CI通过率',
                ascendStats.ciPassRate,
                '%',
                { color: ascendStats.ciPassRate >= 80 ? '#00AC4F' : '#D0004B' },
                1,
              )}
              {renderMetric('CI不通过', ascendStats.ciFailCount, '个', { color: '#D0004B' })}
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={[20, 20]} className="overview-section">
        <Col span={12}>
          <Card className="chart-card"><ReactECharts option={kunpengPieOption} style={{ height: 340 }} /></Card>
        </Col>
        <Col span={12}>
          <Card className="chart-card"><ReactECharts option={ascendPieOption} style={{ height: 340 }} /></Card>
        </Col>
      </Row>

      <Row className="overview-section">
        <Col span={24}>
          <Card title="待关注项（功能失败 / 性能回退）" className="risk-card">
            <Table className="project-table risk-table" columns={riskColumns} dataSource={riskData} pagination={false} size="small" locale={{ emptyText: '无异常项' }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
