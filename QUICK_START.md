# YouTube 字幕翻译插件 - 快速开始指南

## 5 分钟快速上手

### 第 1 步：获取 API Key（2 分钟）

1. 打开浏览器，访问 https://platform.openai.com/api-keys
2. 登录 OpenAI 账户（没有账户需先注册）
3. 点击 **Create new secret key**
4. 复制生成的 Key，形如 `sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### 第 2 步：在 Loon 中安装插件（2 分钟）

1. 打开 Loon App
2. 进入 **配置** → **插件**
3. 点击 **+** 按钮
4. 选择 **添加插件**
5. 在 URL 字段粘贴以下地址：
   ```
   https://raw.githubusercontent.com/YOUR_USERNAME/youtube-translate-loon/main/YouTube_Translate.plugin
   ```
   （如果没有 GitHub 仓库，可以手动复制 `YouTube_Translate.plugin` 文件的内容）

6. 别名填写：`YouTube 字幕翻译`
7. 点击 **保存**

### 第 3 步：配置 API Key（1 分钟）

**方式 A：快速配置（推荐）**

1. 在 Loon 中打开 **脚本编辑器**
2. 新建脚本，粘贴以下代码：
   ```javascript
   $persistentStore.write("sk-你的API_Key", "ChatGPT_API_Key");
   $notification.post("配置成功", "API Key 已保存", "");
   $done();
   ```
3. 将 `sk-你的API_Key` 替换为你在第 1 步复制的 Key
4. 运行脚本

**方式 B：编辑配置文件**

1. 编辑 `set_chatgpt_api.js` 文件
2. 将第 7 行的 `YOUR_API_KEY_HERE` 改为你的 API Key
3. 在 Loon 中执行此脚本

### 第 4 步：开始使用（立即）

1. 打开 YouTube App
2. 播放任何有英文字幕的视频
3. 打开字幕
4. 等待 2-5 秒，字幕自动翻译为中文

## 常见问题速查

| 问题 | 解决方案 |
|------|--------|
| 字幕不翻译 | 检查 API Key 是否正确；检查 Loon 是否启用了该插件 |
| 翻译很慢 | 这是正常的，首次翻译需要 2-5 秒；检查网络连接 |
| 翻译错误 | 这是 ChatGPT 的问题，不是插件的问题 |
| 插件无法加载 | 检查 MITM 证书是否已安装；检查 URL 是否正确 |

## 成本提示

- 平均每条字幕翻译成本：**$0.0001 - $0.001**
- 看 1 小时视频（约 300 条字幕）的成本：**$0.03 - $0.30**
- 建议使用 `gpt-3.5-turbo` 模型以降低成本

## 下一步

- 查看 [完整文档](README.md) 了解高级配置
- 在 GitHub 上提交 Issue 反馈问题
- 根据需要修改翻译语言或模型

祝你使用愉快！🎉
