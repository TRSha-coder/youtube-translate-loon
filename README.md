# YouTube 字幕翻译插件 (Loon)

## 项目介绍

这是一个为 Loon 代理工具开发的插件，用于实时翻译 YouTube 官方 App 中的英文字幕为中文。该插件通过拦截 YouTube 的字幕请求，调用 OpenAI 的 ChatGPT API 进行翻译，然后将翻译结果替换原字幕返回给客户端。

**核心特性：**

- ✅ 实时拦截 YouTube 字幕请求
- ✅ 使用 ChatGPT API 进行高质量翻译
- ✅ 支持自定义 API Key 和模型选择
- ✅ 支持第三方 API 中转服务
- ✅ 完全开源，易于定制和扩展

## 文件说明

| 文件名 | 说明 |
|--------|------|
| `YouTube_Translate.plugin` | Loon 插件配置文件（主文件） |
| `youtube_translate.js` | 核心翻译脚本，拦截并翻译字幕 |
| `set_chatgpt_api.js` | API Key 配置脚本（可选） |
| `README.md` | 本文档 |

## 前置要求

1. **iOS 设备** 安装了 Loon 应用（需要付费购买）
2. **ChatGPT API Key** 从 [OpenAI 官网](https://platform.openai.com/api-keys) 获取
3. **YouTube 官方 App** 已安装在 iOS 设备上

## 安装步骤

### 方法一：直接添加插件（推荐）

1. 打开 Loon 应用，进入 **配置** 标签页
2. 点击 **插件** 选项
3. 点击右上角的 **+** 按钮，选择 **添加插件**
4. 在 **URL** 字段中填入以下地址之一：
   - GitHub 原始文件地址：`https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/YouTube_Translate.plugin`
   - 或者将本地文件上传到云端后获取的 URL

5. 在 **别名** 字段中填入：`YouTube 字幕翻译`
6. 点击 **保存**

### 方法二：本地导入

1. 将 `YouTube_Translate.plugin` 文件复制到 Loon 的配置目录
2. 打开 Loon，进入 **配置** 标签页
3. 点击 **插件**，找到 `YouTube 字幕翻译` 插件
4. 点击 **编辑** 进行配置

## 配置 API Key

### 步骤 1：获取 ChatGPT API Key

1. 访问 [OpenAI 官网](https://platform.openai.com/api-keys)
2. 登录你的账户（如果没有账户，需要先注册）
3. 点击 **Create new secret key**
4. 复制生成的 API Key（注意：这个 Key 只会显示一次，请妥善保管）

### 步骤 2：在 Loon 中设置 API Key

**方法 A：通过脚本配置（推荐）**

1. 编辑 `set_chatgpt_api.js` 文件，将 `YOUR_API_KEY_HERE` 替换为你的实际 API Key
2. 在 Loon 中添加此脚本作为一个 cron 任务或手动执行
3. 脚本会将 API Key 保存到 Loon 的持久化存储中

**方法 B：手动设置（高级用户）**

1. 打开 Loon 的脚本编辑器
2. 执行以下代码：
   ```javascript
   $persistentStore.write("sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", "ChatGPT_API_Key");
   $persistentStore.write("gpt-3.5-turbo", "ChatGPT_Model");
   $persistentStore.write("https://api.openai.com/v1/chat/completions", "ChatGPT_API_URL");
   ```
3. 将上述代码中的 `sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` 替换为你的实际 API Key

## 使用方法

1. 确保已正确配置 API Key（参考上一章节）
2. 在 Loon 中启用 **YouTube 字幕翻译** 插件
3. 打开 YouTube 官方 App，播放任何有英文字幕的视频
4. 打开字幕，系统会自动拦截字幕请求并进行翻译
5. 稍等片刻（通常 2-5 秒），字幕将被替换为中文

**注意事项：**

- 首次加载字幕时可能需要较长时间，因为需要调用 API 进行翻译
- 如果字幕加载失败，请检查网络连接和 API Key 是否正确
- 翻译质量取决于 ChatGPT 模型的版本，建议使用 `gpt-3.5-turbo` 或更高版本

## 高级配置

### 修改翻译模型

编辑 `set_chatgpt_api.js`，修改以下行：

```javascript
const model = "gpt-4-turbo"; // 改为你想要的模型
```

支持的模型包括：
- `gpt-3.5-turbo`（推荐，成本低）
- `gpt-4-turbo`（更精准，成本高）
- `gpt-4`（最精准，成本最高）

### 使用第三方 API 中转

如果你使用了第三方 API 中转服务（例如国内中转），修改 `set_chatgpt_api.js` 中的：

```javascript
const apiUrl = "https://your-proxy-api.com/v1/chat/completions";
```

## 故障排查

| 问题 | 原因 | 解决方案 |
|------|------|--------|
| 字幕不翻译 | API Key 未设置或错误 | 检查 API Key 是否正确配置 |
| 翻译速度很慢 | API 响应缓慢或网络问题 | 检查网络连接，或切换到更快的 API 中转 |
| 翻译结果不准确 | 模型版本过低 | 升级到 `gpt-4-turbo` 或 `gpt-4` |
| 插件无法启用 | MITM 证书未安装 | 在 Loon 中安装并信任 MITM 证书 |
| 字幕显示为乱码 | 字幕编码问题 | 这是 YouTube 的问题，与插件无关 |

## 成本估算

ChatGPT API 的费用基于 token 消耗计算。YouTube 字幕通常每条 10-50 个 token，具体费用如下：

| 模型 | 输入价格 | 输出价格 | 每条字幕成本（估算） |
|------|---------|---------|------------------|
| gpt-3.5-turbo | $0.50/1M tokens | $1.50/1M tokens | $0.0001-0.001 |
| gpt-4-turbo | $10/1M tokens | $30/1M tokens | $0.002-0.02 |
| gpt-4 | $30/1M tokens | $60/1M tokens | $0.006-0.06 |

**建议：** 使用 `gpt-3.5-turbo` 可以在保证翻译质量的同时降低成本。

## 常见问题

**Q: 这个插件会记录我的字幕内容吗？**

A: 不会。插件只在本地拦截字幕，然后发送给 OpenAI API 进行翻译。OpenAI 会根据其隐私政策处理数据。建议查阅 OpenAI 的隐私声明了解更多信息。

**Q: 可以翻译成其他语言吗？**

A: 可以。编辑 `youtube_translate.js` 中的 `systemPrompt` 变量，将"简体中文"改为你想要的语言即可。

**Q: 为什么有些字幕没有被翻译？**

A: 可能的原因包括：
- 该视频没有英文字幕
- 字幕格式不被支持
- API 请求超时
- 网络连接中断

**Q: 可以离线使用吗？**

A: 不可以。该插件依赖 ChatGPT API，需要网络连接才能工作。

## 许可证

本项目采用 MIT 许可证。详见 LICENSE 文件。

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！

## 免责声明

本插件仅供学习和研究使用。使用者需自行承担使用本插件产生的所有后果，包括但不限于：

- ChatGPT API 费用
- YouTube 服务条款违反（如有）
- 任何数据泄露或隐私问题

开发者不承担任何责任。

## 更新日志

### v1.0 (2026-03-25)
- 初始版本发布
- 支持英文字幕翻译为中文
- 支持自定义 API Key 和模型
- 支持第三方 API 中转

## 联系方式

如有问题或建议，请通过以下方式联系：

- 提交 GitHub Issue
- 发送邮件至 support@example.com
