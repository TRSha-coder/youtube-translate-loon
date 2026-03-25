/**
 * ChatGPT API 配置脚本 (Loon)
 * 在 Loon 脚本编辑器中运行此脚本以保存 API 配置
 *
 * 使用方法：
 * 1. 将下方 YOUR_API_KEY_HERE 替换为你的真实 API Key
 * 2. 在 Loon → 工具 → 脚本编辑器 中粘贴并运行
 */

const key    = "YOUR_API_KEY_HERE";                         // 替换为你的 API Key
const model  = "gpt-3.5-turbo";                             // 可改为 gpt-4o、gpt-4-turbo 等
const apiUrl = "https://api.openai.com/v1/chat/completions"; // 如使用中转服务请修改此地址

if (key === "YOUR_API_KEY_HERE" || key.trim() === "") {
    $notification.post("配置失败", "请先填写你的 API Key", "将脚本中 YOUR_API_KEY_HERE 替换为真实的 API Key");
    $done();
}

const isKeySaved   = $persistentStore.write(key, "ChatGPT_API_Key");
const isModelSaved = $persistentStore.write(model, "ChatGPT_Model");
const isUrlSaved   = $persistentStore.write(apiUrl, "ChatGPT_API_URL");

if (isKeySaved && isModelSaved && isUrlSaved) {
    $notification.post(
        "YouTube翻译 - 配置成功",
        "API 参数已保存到 Loon",
        "Key: " + key.substring(0, 7) + "...\nModel: " + model
    );
} else {
    $notification.post("YouTube翻译 - 配置失败", "持久化存储写入失败", "请检查 Loon 权限设置");
}

$done();
