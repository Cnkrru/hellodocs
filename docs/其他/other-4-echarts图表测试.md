# ECharts 图表测试

本文档验证 echarts 图表组件的渲染效果。语法：\`\`\`echarts 代码块，内容为图表 option 的 JSON。

## 柱状图

```echarts
{
  "height": 320,
  "title": { "text": "周访问量", "left": "center" },
  "tooltip": {},
  "xAxis": { "type": "category", "data": ["周一", "周二", "周三", "周四", "周五", "周六", "周日"] },
  "yAxis": { "type": "value" },
  "series": [ { "name": "访问量", "type": "bar", "data": [120, 200, 150, 80, 70, 110, 130] } ]
}
```

## 折线图

```echarts
{
  "height": 300,
  "tooltip": { "trigger": "axis" },
  "xAxis": { "type": "category", "data": ["1月", "2月", "3月", "4月", "5月", "6月"] },
  "yAxis": { "type": "value" },
  "series": [ { "name": "文章数", "type": "line", "smooth": true, "data": [3, 5, 4, 8, 6, 10] } ]
}
```

## 饼图

```echarts
{
  "height": 300,
  "title": { "text": "内容分类占比", "left": "center" },
  "tooltip": { "trigger": "item" },
  "series": [ { "type": "pie", "radius": "60%", "data": [ { "value": 35, "name": "前端" }, { "value": 25, "name": "后端" }, { "value": 20, "name": "硬件" }, { "value": 20, "name": "其他" } ] } ]
}
```

## 非法 JSON 降级测试

下面这个块故意写错 JSON，应降级为源码文本展示而不打断编译：

```echarts
{ this is not valid json }
```

## 卡片网格（cards）

```cards
Vue 3 | 渐进式前端框架 | https://cn.vuejs.org
Vite | 下一代构建工具 | https://cn.vitejs.dev
TypeScript | JavaScript 超集 | https://www.typescriptlang.org
ECharts | 数据可视化图表库
```

## 进度条（progress）

```progress
前端 | 85
后端 | 60
硬件 | 40
数学 | 25
```

## 属性列表（attrs）

```attrs
框架 | Vue 3.5 + Vite 8
渲染 | vite-ssg 静态生成
图表 | ECharts 6 + Mermaid 11
搜索 | MiniSearch 本地全文
```
