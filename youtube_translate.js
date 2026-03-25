/**
 * YouTube 字幕翻译脚本 (Loon)
 * 版本: 1.4 - 全面加固错误处理，任何异常均回退原始字幕
 */

const originalBody = $response.body; // 始终保存原始 body 作为兜底

if (!originalBody) {
    $done({});
    return;
}

const apiKey = $persistentStore.read("ChatGPT_API_Key");
const customModel = $persistentStore.read("ChatGPT_Model") || "gpt-3.5-turbo";
const customApiUrl = $persistentStore.read("ChatGPT_API_URL") || "https://api.openai.com/v1/chat/completions";

if (!apiKey) {
    console.log("[YouTube翻译] 未配置 API Key，返回原始字幕");
    $done({ body: originalBody });
    return;
}

const MAX_SEGMENTS = 60;
const SEP = "|||";

const systemPrompt = "你是专业字幕翻译员，将带编号的字幕翻译成简体中文。\n格式：编号" + SEP + "译文（一行一条）\n仅输出译文，不加解释。若已是中文原样输出。";

function safeFinish(body) {
    try { $done({ body: body || originalBody }); } catch(e) {}
}

function callApi(texts, callback) {
    var prompt = texts.map(function(t, i) { return i + SEP + t; }).join("\n");
    try {
        $httpClient.post({
            url: customApiUrl,
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
            body: JSON.stringify({
                model: customModel,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                temperature: 0.3,
                max_tokens: 2000
            })
        }, function(error, resp, data) {
            try {
                if (error) { console.log("[YouTube翻译] API错误: " + error); callback(null); return; }
                var res = JSON.parse(data);
                if (res.error) { console.log("[YouTube翻译] API返回错误: " + res.error.message); callback(null); return; }
                if (!res.choices || !res.choices[0]) { callback(null); return; }
                var dict = {};
                res.choices[0].message.content.trim().split("\n").forEach(function(line) {
                    var si = line.indexOf(SEP);
                    if (si > 0) {
                        var idx = parseInt(line.substring(0, si).trim(), 10);
                        var txt = line.substring(si + SEP.length).trim();
                        if (!isNaN(idx) && txt) dict[idx] = txt;
                    }
                });
                callback(dict);
            } catch(e) {
                console.log("[YouTube翻译] 解析响应异常: " + e);
                callback(null);
            }
        });
    } catch(e) {
        console.log("[YouTube翻译] 发起请求异常: " + e);
        callback(null);
    }
}

function decodeXml(s) {
    return s.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}
function encodeXml(s) {
    return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

try {
    var body = originalBody.trim();

    if (body.indexOf("<?xml") === 0 || body.indexOf("<transcript") === 0) {
        // ===== XML (srv3) 格式 =====
        var segments = [];
        var re = /(<text\b[^>]*>)([\s\S]*?)(<\/text>)/g;
        var m;
        while ((m = re.exec(body)) !== null) {
            var clean = decodeXml(m[2]).replace(/\n/g, " ").trim();
            if (clean) {
                segments.push({ openTag: m[1], raw: m[2], text: clean, pos: m.index });
                if (segments.length >= MAX_SEGMENTS) break;
            }
        }

        if (segments.length === 0) { safeFinish(originalBody); return; }

        callApi(segments.map(function(s) { return s.text; }), function(dict) {
            try {
                if (!dict || Object.keys(dict).length === 0) {
                    console.log("[YouTube翻译] 翻译失败，返回原始字幕");
                    safeFinish(originalBody);
                    return;
                }
                var result = body;
                var offset = 0;
                segments.forEach(function(seg, idx) {
                    if (dict[idx] !== undefined) {
                        var newText = encodeXml(dict[idx]);
                        var start = seg.pos + offset + seg.openTag.length;
                        var end = start + seg.raw.length;
                        result = result.substring(0, start) + newText + result.substring(end);
                        offset += newText.length - seg.raw.length;
                    }
                });
                console.log("[YouTube翻译] XML翻译完成，共" + Object.keys(dict).length + "条");
                safeFinish(result);
            } catch(e) {
                console.log("[YouTube翻译] XML替换异常: " + e);
                safeFinish(originalBody);
            }
        });

    } else {
        // ===== JSON (json3) 格式 =====
        var data = JSON.parse(body);
        var events = data.events;
        if (!events || events.length === 0) { safeFinish(originalBody); return; }

        var texts = [], mapping = [];
        for (var i = 0; i < events.length; i++) {
            var ev = events[i];
            if (ev.segs) {
                for (var j = 0; j < ev.segs.length; j++) {
                    var seg = ev.segs[j];
                    var raw = seg.utf8;
                    if (raw && raw.trim() && raw.trim() !== "\n") {
                        texts.push(raw.replace(/\n/g, " ").trim());
                        mapping.push({ ei: i, si: j });
                        if (texts.length >= MAX_SEGMENTS) break;
                    }
                }
            }
            if (texts.length >= MAX_SEGMENTS) break;
        }

        if (texts.length === 0) { safeFinish(originalBody); return; }

        callApi(texts, function(dict) {
            try {
                if (!dict || Object.keys(dict).length === 0) {
                    console.log("[YouTube翻译] 翻译失败，返回原始字幕");
                    safeFinish(originalBody);
                    return;
                }
                var count = 0;
                mapping.forEach(function(mp, idx) {
                    if (dict[idx] !== undefined) {
                        events[mp.ei].segs[mp.si].utf8 = dict[idx];
                        count++;
                    }
                });
                console.log("[YouTube翻译] JSON翻译完成，共" + count + "条");
                safeFinish(JSON.stringify(data));
            } catch(e) {
                console.log("[YouTube翻译] JSON替换异常: " + e);
                safeFinish(originalBody);
            }
        });
    }

} catch(e) {
    console.log("[YouTube翻译] 顶层异常: " + e);
    safeFinish(originalBody);
}
