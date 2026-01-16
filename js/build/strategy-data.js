// 这个文件会在 Swup 切换后重新执行
// 把 SSR 注入的数据写入全局变量
window.rangeSeriesMap = window.__STRATEGY_DATA__ || {};
