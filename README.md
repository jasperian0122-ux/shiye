# 拾页 · SHIYE

一个慢读慢写的博客站。没有推荐算法，没有三十秒读完的摘要，只有作者认真写完的一页。

## 在线地址

| 端点 | 地址 | 说明 |
|---|---|---|
| 正式站（可读 / 可写 / 可登录） | https://shiyeblog.app.workbuddy.host/?sharecode=HPOWC74VSU | 完整功能，含验证码登录 |
| 公开入口页（可被搜索引擎收录） | https://jasperian0122-ux.github.io/shiye/ | GitHub Pages，静态目录页 |

## 功能

- 杂志式首页：编辑精选 + 编号文章列表，标签筛选与标题搜索
- 文章页：首字下沉、阅读进度条、点赞 / 收藏、继续读推荐
- 写作页：Markdown 编辑 + 实时预览、草稿 / 发布 / 更新 / 删除
- 个人页：资料编辑、已发布 / 草稿 / 收藏管理
- 登录：手机号 / 邮箱验证码（首次登录自动注册）

## 技术结构

```
index.html          首页
post.html           文章页
write.html          写作页
me.html             个人页
login.html          登录页
assets/
  cloud.js          云服务客户端、会话、Markdown 渲染、数据访问层
  home.js / post.js / write.js / me.js / login.js   各页面逻辑
  styles.css        设计系统（纸感、墨色、朱砂）
docs/               GitHub Pages 用的公开入口页
```

- 纯原生 HTML / CSS / JavaScript，无构建步骤、无框架依赖
- 后端为 WorkBuddy 托管云服务：云数据库（`posts` / `profiles` / `likes` / `bookmarks`，均已配置行级安全）+ 终端用户认证 + 文件存储
- 注意：云服务端强制精确匹配 Origin，因此 GitHub Pages 上的静态页无法直连该后端；写作与登录请使用正式站

## 本地运行

```bash
python3 -m http.server 4173
# 打开 http://localhost:4173
```
