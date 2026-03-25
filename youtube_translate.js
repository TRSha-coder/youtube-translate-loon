/**
 * YouTube 字幕翻译脚本 (Loon)
 * 拦截 YouTube 字幕请求，使用 ChatGPT API 将其翻译为中文
 */

const url = $request.url;
let body = $response.body;

if (!body) {
    $done({});
}

// 从 Loon 的持久化存储中获取 API Key
// 用户需要在 Loon 中运行一个配置脚本或手动设置该值
const apiKey = $persistentStore.read("ChatGPT_API_Key");
const customModel = $persistentStore.read("ChatGPT_Model") || "gpt-3.5-turbo";
const customApiUrl = $persistentStore.read("ChatGPT_API_URL") || "https://api.openai.com/v1/chat/completions";

if (!apiKey) {
    console.log("未配置 ChatGPT_API_Key，跳过翻译。请在 Loon 中设置该键值。");
    $done({ body });
}

try {
    // YouTube 字幕通常以 JSON 格式返回 (fmt=json3)
    let subtitleData = JSON.parse(body);
    let events = subtitleData.events;
    
    if (!events || events.length === 0) {
        $done({ body });
    }

    // 提取需要翻译的文本
    let textsToTranslate = [];
    let textMapping = []; // 记录文本在 events 中的位置

    for (let i = 0; i < events.length; i++) {
        let event = events[i];
        if (event.segs) {
            for (let j = 0; j < event.segs.length; j++) {
                let seg = event.segs[j];
                if (seg.utf8 && seg.utf8.trim() !== "") {
                    // 过滤掉换行符等不可见字符，保留有意义的文本
                    let cleanText = seg.utf8.replace(/\n/g, " ");
                    textsToTranslate.push(cleanText);
                    textMapping.push({ eventIndex: i, segIndex: j });
                }
            }
        }
    }

    if (textsToTranslate.length === 0) {
        $done({ body });
    }

    // 组合翻译 Prompt
    // 为了避免超出 API 限制或翻译错位，我们将文本用特殊分隔符连接，或者带上序号
    // 这里采用带序号的方式，以确保返回的行数一致
    let promptText = textsToTranslate.map((text, index) => `${index}::${text}`).join("\n");
    
    const systemPrompt = "你是一个专业的字幕翻译员。请将以下带有序号的 YouTube 视频英文字幕翻译成流畅的简体中文。要求：\n1. 保持原有的序号和格式 `序号::翻译文本`\n2. 仅输出翻译后的内容，不要有任何解释或额外说明\n3. 结合上下文进行意译，使其符合中文表达习惯。";

    const request = {
        url: customApiUrl,
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + apiKey
        },
        body: JSON.stringify({
            model: customModel,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: promptText }
            ],
            temperature: 0.3
        })
    };

    // 发起异步请求调用 ChatGPT API
    $httpClient.post(request, function(error, response, data) {
        if (error) {
            console.log("ChatGPT API 请求失败: " + error);
            $done({ body });
        } else {
            try {
                let resData = JSON.parse(data);
                if (resData.choices && resData.choices.length > 0) {
                    let translatedText = resData.choices[0].message.content;
                    let translatedLines = translatedText.split("\n");
                    
                    // 解析翻译结果并替换原字幕
                    let translationDict = {};
                    translatedLines.forEach(line => {
                        let parts = line.split("::");
                        if (parts.length >= 2) {
                            let index = parseInt(parts[0]);
                            let text = parts.slice(1).join("::").trim();
                            if (!isNaN(index)) {
                                translationDict[index] = text;
                            }
                        }
                    });

                    // 将翻译结果写回原数据结构
                    textMapping.forEach((mapping, index) => {
                        if (translationDict[index]) {
                            // 保留原语言作为双语字幕，或者直接替换。这里选择直接替换为中文
                            events[mapping.eventIndex].segs[mapping.segIndex].utf8 = translationDict[index] + " ";
                        }
                    });
                    
                    // 返回修改后的字幕 JSON
                    $done({ body: JSON.stringify(subtitleData) });
                } else {
                    console.log("ChatGPT API 返回格式异常: " + data);
                    $done({ body });
                }
            } catch (e) {
                console.log("解析 ChatGPT 响应失败: " + e + "\n响应内容: " + data);
                $done({ body });
            }
        }
    });

} catch (e) {
    console.log("解析 YouTube 字幕 JSON 失败: " + e);
    // 如果不是 JSON 格式，直接返回原内容
    $done({ body });
}
