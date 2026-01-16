(function () {
  function isStrategyPage() {
    return location.pathname.includes('/strategy');
  }

  let cleanupTasks = [];
  let chartInstance = null;

  function initChart() {
    const chartDom = document.getElementById('strategy-return-chart');
    const tabsContainer = document.getElementById('strategy-range-tabs');

    if (!chartDom || typeof echarts === 'undefined') return;

    const chart = echarts.init(chartDom);
    chartInstance = chart;

    const getVar = (name, fallback) => {
      const val = getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        ?.trim();
      return val || fallback;
    };

    const rangeSeriesMap = window.rangeSeriesMap;


    function buildOption(rangeKey) {
      const data = rangeSeriesMap[rangeKey] || rangeSeriesMap.all;

      const lineStrategy = getVar('--chart-line-strategy', '#4a90e2');
      const lineBenchmark = getVar('--chart-line-benchmark', '#6ac46a');
      const textPrimary = getVar('--chart-text-primary', '#333333');
      const textSecondary = getVar('--chart-text-secondary', '#666666');
      const tooltipBg = getVar('--chart-tooltip-bg', '#ffffff');
      const tooltipText = getVar('--chart-tooltip-text', '#333333');
      const splitLine = getVar('--chart-split-line', '#eeeeee');

      return {
        tooltip: {
          trigger: 'axis',
          backgroundColor: tooltipBg,
          borderColor: 'rgba(0,0,0,0.15)',
          textStyle: { color: tooltipText },
          formatter(params) {
            const date = params[0]?.name || '';
            const lines = params.map(p => `${p.seriesName}: ${p.value.toFixed(2)}%`);
            return `${date}<br/>${lines.join('<br/>')}`;
          }
        },
        legend: {
          data: ['策略收益', '沪深300ETF'],
          top: 10,
          right: 20,
          textStyle: { color: textPrimary, fontSize: 12 }
        },
        grid: {
          left: '3%',
          right: '4%',
          bottom: '3%',
          top: 50,
          containLabel: true
        },
        xAxis: {
          type: 'category',
          data: data.dates,
          axisLine: { lineStyle: { color: textSecondary } },
          axisLabel: { color: textSecondary }
        },
        yAxis: {
          type: 'value',
          axisLine: { lineStyle: { color: textSecondary } },
          axisLabel: { color: textSecondary },
          splitLine: { lineStyle: { color: splitLine } }
        },
        series: [
          {
            name: '策略收益',
            type: 'line',
            smooth: true,
            data: data.strategy,
            lineStyle: { width: 3, color: lineStrategy },
            symbol: 'circle',
            symbolSize: 6,
            itemStyle: { color: lineStrategy }
          },
          {
            name: '沪深300ETF',
            type: 'line',
            smooth: true,
            data: data.benchmark,
            lineStyle: { width: 3, color: lineBenchmark },
            symbol: 'circle',
            symbolSize: 6,
            itemStyle: { color: lineBenchmark }
          }
        ],
        animationDuration: 500
      };
    }

    chart.setOption(buildOption('ytd'));

    if (tabsContainer) {
      const handler = e => {
        const btn = e.target.closest('.range-tab');
        if (!btn) return;
        const range = btn.getAttribute('data-range');

        tabsContainer.querySelectorAll('.range-tab').forEach(el => {
          el.classList.toggle('active', el === btn);
        });

        chart.setOption(buildOption(range), true);
      };
      tabsContainer.addEventListener('click', handler);
      cleanupTasks.push(() => tabsContainer.removeEventListener('click', handler));
    }

    const resizeHandler = () => chart.resize();
    window.addEventListener('resize', resizeHandler);
    cleanupTasks.push(() => window.removeEventListener('resize', resizeHandler));
  }

 

function initCalendar() {
  const card = document.querySelector('.strategy-calendar-card');
  const grid = document.getElementById('calendar-grid');
  const summary = document.getElementById('calendar-summary');
  const yearEl = document.getElementById('calendar-year');
  const monthEl = document.getElementById('calendar-month');
  const tabs = document.querySelectorAll('.calendar-tab');
  const prevBtn = document.getElementById('prev-month');
  const nextBtn = document.getElementById('next-month');

  if (!card || !grid || !summary || !yearEl || !monthEl || !tabs.length) return;

  let mode = 'daily';

  // ⭐ 从 SSR 注入的数据读取（关键）
  const { dailyData, monthlyData, yearlyData } = window.calendarData || {};

  // ⭐ 自动设置默认年月（使用 CSV 最后一行日期）
  let year = 2025;
  let month = 1;

  const last = window.rangeSeriesMap?.all?.dates?.slice(-1)[0];
  if (last) {
    const d = new Date(last);
    year = d.getFullYear();
    month = d.getMonth() + 1;
  }

  function getDaysInMonth(y, m) {
    return new Date(y, m, 0).getDate();
  }

  function getWeekday(y, m, d) {
    return new Date(y, m - 1, d).getDay();
  }

  function buildDailyCalendar(y, m, dataMap) {
    const days = getDaysInMonth(y, m);
    const rows = [];
    let week = [null, null, null, null, null];

    for (let d = 1; d <= days; d++) {
      const wd = getWeekday(y, m, d);
      if (wd >= 1 && wd <= 5) {
        week[wd - 1] = dataMap[d] || { day: d, profit: 0, amount: '0' };
        week[wd - 1].day = d;
      }
      if (wd === 5) {
        rows.push(week);
        week = [null, null, null, null, null];
      }
    }
    if (week.some(x => x !== null)) rows.push(week);
    return rows;
  }

  function buildMonthlyCalendar(list) {
    const rows = [];
    for (let i = 0; i < list.length; i += 4) {
      rows.push(list.slice(i, i + 4));
    }
    return rows;
  }

  function buildYearlyCalendar(list) {
    return [list];
  }

  function render() {
    card.dataset.mode = mode;
    yearEl.textContent = year;
    monthEl.textContent = month;

    let rows = [];
    let summaryText = '';

    if (mode === 'daily') {
  const data = dailyData?.[year]?.[month] || {};
  rows = buildDailyCalendar(year, month, data);

  // ⭐ 当月收益率（所有天的 dailyReturnRate 累加）
  const monthProfit = Object.values(data).reduce(
    (sum, d) => sum + (d.profit || 0),
    0
  );

  // ⭐ 当月收益金额（所有天的 dailyProfit 累加）
  const monthAmount = Object.values(data).reduce(
    (sum, d) => sum + (parseFloat(d.amount) || 0),
    0
  );

  summaryText = `当月收益：${monthProfit.toFixed(2)}%（${monthAmount}）`;

} else if (mode === 'monthly') {
  const list = monthlyData?.[year] || [];
  rows = buildMonthlyCalendar(list);

  // ⭐ 年度收益率（所有月收益率累加）
  const yearProfit = list.reduce(
    (sum, m) => sum + (m.profit || 0),
    0
  );

  // ⭐ 年度收益金额（所有月收益金额累加）
  const yearAmount = list.reduce(
    (sum, m) => sum + (parseFloat(m.amount) || 0),
    0
  );

  summaryText = `年度收益：${yearProfit.toFixed(2)}%（${yearAmount}）`;

} else {
  rows = buildYearlyCalendar(yearlyData || []);

  // ⭐ 累计收益率（所有年收益率累加）
  const totalProfit = (yearlyData || []).reduce(
    (sum, y) => sum + (y.profit || 0),
    0
  );

  // ⭐ 累计收益金额（所有年收益金额累加）
  const totalAmount = (yearlyData || []).reduce(
    (sum, y) => sum + (parseFloat(y.amount) || 0),
    0
  );

  summaryText = `累计收益：${totalProfit.toFixed(2)}%（${totalAmount}）`;
}


    grid.innerHTML = rows
      .map(
        week => `
      <div class="calendar-week">
        ${week
          .map(cell =>
            cell
              ? `
          <div class="calendar-cell ${
            cell.profit > 0
              ? 'positive'
              : cell.profit < 0
              ? 'negative'
              : 'neutral'
          }">
            <div class="date">${
              cell.day
                ? cell.day + '日'
                : cell.month
                ? cell.month + '月'
                : cell.year + '年'
            }</div>
            <div class="percent">${cell.profit}%</div>
            <div class="amount">${cell.amount}</div>
          </div>`
              : '<div class="calendar-cell empty"></div>'
          )
          .join('')}
      </div>`
      )
      .join('');

    summary.textContent = summaryText;

    const visible = mode === 'daily' ? 'visible' : 'hidden';
    if (prevBtn && nextBtn) {
      prevBtn.style.visibility = visible;
      nextBtn.style.visibility = visible;
    }
  }

  tabs.forEach(tab => {
    const handler = () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      mode = tab.dataset.mode;
      render();
    };
    tab.addEventListener('click', handler);
    cleanupTasks.push(() => tab.removeEventListener('click', handler));
  });

  if (prevBtn) {
    const prevHandler = () => {
      if (mode !== 'daily') return;
      month--;
      if (month === 0) {
        month = 12;
        year--;
      }
      render();
    };
    prevBtn.addEventListener('click', prevHandler);
    cleanupTasks.push(() => prevBtn.removeEventListener('click', prevHandler));
  }

  if (nextBtn) {
    const nextHandler = () => {
      if (mode !== 'daily') return;
      month++;
      if (month === 13) {
        month = 1;
        year++;
      }
      render();
    };
    nextBtn.addEventListener('click', nextHandler);
    cleanupTasks.push(() => nextBtn.removeEventListener('click', nextHandler));
  }

  render();
}


  function destroy() {
    cleanupTasks.forEach(fn => fn());
    cleanupTasks = [];
    if (chartInstance) {
      chartInstance.dispose();
      chartInstance = null;
    }
  }

  function mountIfStrategy() {
    destroy();
    if (!isStrategyPage()) return;
    initChart();
    initCalendar();
  }

  // 初次加载（非 Swup 切换）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountIfStrategy);
  } else {
    mountIfStrategy();
  }

  // Swup 切换后
  document.addEventListener('swup:contentReplaced', mountIfStrategy);
})();
