# OVA APP项目

这是我们为 Ontario Volleyball Association 做的 hackathon 项目 OVA Companion。请先阅读导入的代码和 README，再继续开发。我们希望复用已有功能，主要升级 UI 和实现可访问的在线预览，不要根据项目名称重新生成一套无关应用。

现有系统使用 Node.js 24、SQLite 和移动端优先的网页前端。本地版本此前通过 184 项测试，但不能把这些结果当作迁移后的测试结果。ZIP 不含真实用户数据库或密钥；缺失配置请明确列出，不要编造。

请保留以下功能和规则，并以实际代码核对细节：

默认 Guest 公共首页，无需登录；进入 Account 后进行身份验证，展示对应角色的界面。

家长是主要用户。家庭首页包括关联球员、下一场比赛、最近成绩和 Next Venue 地图入口。

赛程、关注多个球队／组别、历史成绩及可切换的成绩趋势图。日历默认显示当前月及之后两个月。

Profile 右上角统一配对码入口。球队码可供多名队员加入；家属码每段绑定关系独立、单次使用，一个球员可以关联多个家属。不能把不同类型的码合并成同一种权限。

场馆地图、经确认的停车信息、官方视频入口，以及工作人员维护公告、导入和更新名单的功能。

权限检查必须在服务端执行，家属不能查看未关联球员的私有信息。未知赛程、对手、排名和场馆信息应明确显示待定，不得编造。不要加入没有数据支持的个人技术评分或胜率预测。

第一步先给我简短评估，不要立即大规模重写：

哪些功能可直接保留，哪些需要适配？

当前平台能否运行这个 Node + SQLite 后端？如果不能，比较「保留后端、另行部署并通过 API 连接」和「迁移到 Lovable 支持的后端」两条路线，说明工作量、数据与权限风险，并推荐一条。

分清原代码中的真实数据、演示数据，以及当前没有连接的外部服务。

列出需要我提供的配置，不要让我把密钥贴进聊天。

UI 方向：专业、清晰的体育赛事应用，移动端优先，大字号、高对比度、清楚的下一步操作；先优化 Guest 和家属首页，其他页面保持一致。遵循无障碍原则，支持键盘操作和减少动效偏好。

等我确认方案后再实施。迁移后请逐项测试核心流程，报告已完成、未完成和模拟部分；不要未经我确认就公开发布、购买服务或连接真实用户数据。

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ova-match-buddy.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/746c1b2e-7afa-4b70-8f16-01c8241a0565).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
