# TechMark 书签站

这是一个可直接部署到 GitHub Pages 的静态书签导航站，核心文件结构已经压缩为最小可发布版。

## 目录说明
- index.html：前台首页
- admin.html：后台管理入口
- 404.html：GitHub Pages 404 页面
- assets/：样式、脚本与图片资源
- data/bookmarks.json：书签数据源
- .nojekyll：防止 GitHub Pages 忽略静态资源

## 部署方式
1. 将整个项目上传到 GitHub 仓库。
2. 在仓库设置中开启 GitHub Pages。
3. 选择主分支作为发布源即可。
4. 访问地址类似：
   - https://your-name.github.io/your-repo/
   - https://your-name.github.io/your-repo/admin.html

## 说明
- 站点完全依赖前端静态文件，适合 GitHub Pages。
- 后台登录逻辑为前端实现，密码状态保存在浏览器本地。
- 不需要 Apache 配置、PHP 后端或数据库。
