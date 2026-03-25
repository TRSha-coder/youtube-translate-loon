/**
 * YouTube 字幕翻译脚本 (Loon)
 * 拦截 YouTube 字幕请求，使用 ChatGPT API 将其翻译为中文
 * 版本: 1.3 - 同时支持 srv3 (XML) 和 json3 (JSON) 两种格式
 */

const url = $request.url;
let body = $response.body;

if (!body) {
    $done({});
    return;
}

const apiKey = $persistentStore.read("ChatGPT_API_Key");
const customModel = $persistentStore.read("ChatGPT_Model") || "gpt-3.5-turbo";
const customApiUrl = $persistentStore.read("ChatGPT_API_URL") || "https://api.openai.com/v1/chat/completions";

if (!apiKey) {
    console.log("[YouTube翻译] 未配置 ChatGPT_API_Key，跳过翻译。");
    $done({ body });
    return;
}

const MAX_SEGMENTS = 120;
const SEP = "|||";

const systemPrompt = [
    "你是专业的视频字幕翻译员，请将以下带编号的字幕翻译成简体中文。",
    "规则：",
    "1. 严格保持 \"编号" + SEP + "翻译文本\" 格式，一行一条",
    "2. 仅输出翻译结果，不添加任何解释或额外文字",
    "3. 译文应简洁流畅，符合中文表达习惯",
    "4. 若某行原文已是中文，直接原样输出"
].join("\n");

// 调用 ChatGPT API 翻译文本数组
function callTranslateApi(texts, callback) {
    let promptText = texts.map((text, idx) => idx + SEP + text).join("\n");

    $httpClient.post({
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
            temperature: 0.3,
            max_tokens: 2048
        })
    }, function(error, response, data) {
        if (error) {
            console.log("[YouTube翻译] API 请求失败: " + error);
            callback(null);
            return;
        }
        try {
            let resData = JSON.parse(data);
            if (resData.error) {
                console.log("[YouTube翻译] API 错误: " + resData.error.message);
                callback(null);
                return;
            }
            if (!resData.choices || resData.choices.length === 0) {
                console.log("[YouTube翻译] API 返回格式异常: " + data.substring(0, 200));
                callback(null);
                return;
            }
            let translationDict = {};
            resData.choices[0].message.content.trim().split("\n").forEach(function(line) {
                line = line.trim();
                let sepIdx = line.indexOf(SEP);
                if (sepIdx > 0) {
                    let idx = parseInt(line.substring(0, sepIdx).trim(), 10);
                    let text = line.substring(sepIdx + SEP.length).trim();
                    if (!isNaN(idx) && text) translationDict[idx] = text;
                }
            });
            callback(translationDict);
        } catch(e) {
            console.log("[YouTube翻译] 解析 API 响应失败: " + e);
            callback(null);
        }
    });
}

function decodeXml(str) {
    return str
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'");
}

function encodeXml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

let bodyTrimmed = body.trim();

if (bodyTrimmed.startsWith("<?xml") || bodyTrimmed.startsWith("<transcript")) {
    // ========== 处理 srv3 XML 格式 ==========
    console.log("[YouTube翻译] 检测到 XML (srv3) 格式");

    let segments = [];
    let regex = /(<text\b[^>]*>)([\s\S]*?)(<\/text>)/g;
    let match;

    while ((match = regex.exec(bodyTrimmed)) !== null) {
        let cleanText = decodeXml(match[2]).replace(/\n/g, " ").trim();
        if (cleanText) {
            segments.push({
                openTag: match[1],
                rawContent: match[2],
                cleanText: cleanText,
                index: match.index,
            });
            if (segments.length >= MAX_SEGMENTS) break;
        }
    }

    if (segments.length === 0) {
        $done({ body });
        return;
    }

    callTranslateApi(segments.map(function(s) { return s.cleanText; }), function(translationDict) {
        if (!translationDict) {
            $done({ body });
            return;
        }

        // 从后往前替换，避免偏移量错位
        let result = bodyTrimmed;
        let offset = 0;
        segments.forEach(function(seg, idx) {
            if (translationDict[idx] !== undefined) {
                let newContent = encodeXml(translationDict[idx]);
                let contentStart = seg.index + offset + seg.openTag.length;
                let contentEnd = contentStart + seg.rawContent.length;
                result = result.substring(0, contentStart) + newContent + result.substring(contentEnd);
                offset += newContent.length - seg.rawContent.length;
            }
        });

        console.log("[YouTube翻译] XML格式：成功翻译 " + Object.keys(translationDict).length + "/" + segments.length + " 条字幕");
        $done({ body: result });
    });

} else {
    // ========== 处理 json3 JSON 格式 ==========
    try {
        console.log("[YouTube翻译] 检测到 JSON (json3) 格式");

        let subtitleData = JSON.parse(body);
        let events = subtitleData.events;

        if (!events || events.length === 0) {
            $done({ body });
            return;
        }

        let textsToTranslate = [];
        let textMapping = [];

        for (let i = 0; i < events.length; i++) {
            let event = events[i];
            if (event.segs) {
                for (let j = 0; j < event.segs.length; j++) {
                    let seg = event.segs[j];
                    let raw = seg.utf8;
                    if (raw && raw.trim() !== "" && raw.trim() !== "\n") {
                        textsToTranslate.push(raw.replace(/\n/g, " ").trim());
                        textMapping.push({ eventIndex: i, segIndex: j });
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

        callTranslateApi(textsToTranslate, function(translationDict) {
            if (!translationDict) {
                $done({ body });
                return;
            }

            let translatedCount = 0;
            textMapping.forEach(function(mapping, idx) {
                if (translationDict[idx] !== undefined) {
                    events[mapping.eventIndex].segs[mapping.segIndex].utf8 = translationDict[idx];
                    translatedCount++;
                }
            });

            console.log("[YouTube翻译] JSON格式：成功翻译 " + translatedCount + "/" + textsToTranslate.length + " 条字幕");
            $done({ body: JSON.stringify(subtitleData) });
        });

    } catch(e) {
        console.log("[YouTube翻译] 解析字幕失败: " + e);
        $done({ body });
    }
}
