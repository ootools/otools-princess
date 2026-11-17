# 第三方声明

本插件随 `dist/` 分发的产物包含以下第三方代码：

## Vue

- 项目：https://github.com/vuejs/core
- 版本：3.5.27
- 许可证：MIT
- 用途：插件前端框架（运行时打包进 `dist/assets/*.js`）

其余构建依赖（Vite、TypeScript、vue-tsc、@vitejs/plugin-vue 等）仅用于开发期，不进入分发产物。

本插件为纯前端离线游戏：不联网、不调用任何外部 API、不依赖 otools-plugin-sdk，
所有图形由内置 SVG 引擎在本地绘制，公主与部件均为原创造型数据。
