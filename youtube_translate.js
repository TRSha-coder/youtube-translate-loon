/**
 * YouTube 字幕翻译脚本 (Loon)
 * 拦截 YouTube 字幕请求，使用 ChatGPT API 将其翻译为中文
 * 版本: 1.1
 */

const url = $request.url;
let body = $response.body;

// 仅处理 JSON 格式的字幕 (fmt=json3)
if (!body || !url.includes("fmt=json3")) {
    $done({});
    return;
}

// 从 Loon 的持久化存储中获取配置
const apiKey = $persistentStore.read("ChatGPT_API_Key");
const customModel = $persistentStore.read("ChatGPT_Model") || "gpt-3.5-turbo";
const customApiUrl = $persistentStore.read("ChatGPT_API_URL") || "https://api.openai.com/v1/chat/completions";

if (!apiKey) {
    console.log("[YouTube翻译] 未配置 ChatGPT_API_Key，跳过翻译。请先运行配置脚本设置 API Key。");
    $done({ body });
    return;
}

// 单次 API 调用最多翻译的字幕段数，防止超出 token 限制或请求超时
const MAX_SEGMENTS = 120;

// 使用不易与字幕内容冲突的分隔符
const SEP = "|||";

try {
    let subtitleData = JSON.parse(body);
    let events = subtitleData.events;

    if (!events || events.length === 0) {
        $done({ body });
        return;
    }

    // 提取需要翻译的文本及位置
    let textsToTranslate = [];
    let textMapping = []; // 记录文本在 events 中的位置

    for (let i = 0; i < events.length; i++) {
        let event = events[i];
        if (event.segs) {
            for (let j = 0; j < event.segs.length; j++) {
                let seg = event.segs[j];
                let raw = seg.utf8;
                if (raw && raw.trim() !== "" && raw.trim() !== "\n") {
                    let cleanText = raw.replace(/\n/g, " ").trim();
                    textsToTranslate.push(cleanText);
                    textMapping.push({ eventIndex: i, segIndex: j });
                    // 超出上限后停止收集，避免请求过大
                    if (textsToTranslate.length >= MAX_SEGMENTS) break;
                }
            }
        }
        if (textsToTranslate.length >= MAX_SEGMENTS) break;
    }

    if (textsToTranslate.length === 0) {
        $done({ body });
        return;
    }

    // 构造带序号的翻译请求，使用 ||| 作为分隔符
    let promptText = textsToTranslate.map((text, idx) => `${idx}${SEP}${text}`).join("\n");

    const systemPrompt = [
        "你是专业的视频字幕翻译员，请将以下带编号的字幕翻译成简体中文。",
        "规则：",
        `1. 严格保持 "编号${SEP}翻译文本" 格式，一行一条`,
        "2. 仅输出翻译结果，不添加任何解释或额外文字",
        "3. 译文应简洁流畅，符合中文表达习惯",
        "4. 若某行原文已是中文，直接原样输出"
    ].join("\n");

    const requestBody = {
        model: customModel,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: promptText }
        ],
        temperature: 0.3,
        max_tokens: 2048
    };

    const httpRequest = {
        url: customApiUrl,
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + apiKey
        },
        body: JSON.stringify(requestBody)
    };

    $httpClient.post(httpRequest, function(error, response, data) {
        if (error) {
            console.log("[YouTube翻译] API 请求失败: " + error);
            $done({ body });
            return;
        }

        try {
            let resData = JSON.parse(data);

            // 处理 API 错误响应
            if (resData.error) {
                console.log("[YouTube翻译] API 返回错误: " + resData.error.message);
                $done({ body });
                return;
            }

            if (!resData.choices || resData.choices.length === 0) {
                console.log("[YouTube翻译] API 返回格式异常: " + data.substring(0, 300));
                $done({ body });
                return;
            }

            let translatedContent = resData.choices[0].message.content.trim();
            let translationDict = {};

            translatedContent.split("\n").forEach(line => {
                line = line.trim();
                if (!line) return;
                let sepIdx = line.indexOf(SEP);
                if (sepIdx > 0) {
                    let indexStr = line.substring(0, sepIdx).trim();
                    let text = line.substring(sepIdx + SEP.length).trim();
                    let idx = parseInt(indexStr, 10);
                    if (!isNaN(idx) && text) {
                        translationDict[idx] = text;
                    }
                }
            });

            let translatedCount = 0;
            // 将翻译结果写回原字幕数据结构
            textMapping.forEach((mapping, idx) => {
                if (translationDict[idx] !== undefined) {
                    events[mapping.eventIndex].segs[mapping.segIndex].utf8 = translationDict[idx];
                    translatedCount++;
                }
            });

            console.log(`[YouTube翻译] 成功翻译 ${translatedCount}/${textsToTranslate.length} 条字幕`);
            $done({ body: JSON.stringify(subtitleData) });

        } catch (e) {
            console.log("[YouTube翻译] 解析 API 响应失败: " + e + "\n响应内容: " + data.substring(0, 300));
            $done({ body });
        }
    });

} catch (e) {
    console.log("[YouTube翻译] 解析字幕 JSON 失败: " + e);
    $done({ body });
}
