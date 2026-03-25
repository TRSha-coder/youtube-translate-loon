/**
 * ChatGPT API 配置脚本 (Loon)
 * 运行此脚本以设置 API Key 和自定义参数
 */

const key = "YOUR_API_KEY_HERE"; // 在这里填入你的 ChatGPT API Key
const model = "gpt-3.5-turbo"; // 可选：修改为你想要使用的模型
const apiUrl = "https://api.openai.com/v1/chat/completions"; // 可选：如果你使用代理或第三方中转，请修改此地址

const isKeySaved = $persistentStore.write(key, "ChatGPT_API_Key");
const isModelSaved = $persistentStore.write(model, "ChatGPT_Model");
const isUrlSaved = $persistentStore.write(apiUrl, "ChatGPT_API_URL");

if (isKeySaved && isModelSaved && isUrlSaved) {
    $notification.post("ChatGPT API 配置成功", "参数已保存", "Key: " + key.substring(0, 5) + "...\nModel: " + model);
} else {
    $notification.post("ChatGPT API 配置失败", "请检查脚本或 Loon 权限", "");
}

$done();
