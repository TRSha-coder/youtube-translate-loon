/**
 * YouTube 字幕翻译脚本 (Loon)
 * 版本: 2.0 - 独立配置版，无需 BoxJS 或持久化存储
 *
 * ========== 使用前只需修改以下 3 行 ==========
 */
var API_KEY = "sk-在这里填入你的APIKey";           // 必填：你的 OpenAI API Key
var API_MODEL = "gpt-3.5-turbo";                   // 可选：翻译模型
var API_URL = "https://api.openai.com/v1/chat/completions"; // 可选：API 地址（中转服务请修改）
/**
 * =============================================
 */

var originalBody = $response.body;

if (!originalBody) {
    $done({});
    return;
}

// 支持从持久化存储读取（BoxJS 配置优先）
var apiKey = $persistentStore.read("ChatGPT_API_Key") || API_KEY;
var model  = $persistentStore.read("ChatGPT_Model")   || API_MODEL;
var apiUrl = $persistentStore.read("ChatGPT_API_URL") || API_URL;

if (!apiKey || apiKey === "sk-在这里填入你的APIKey") {
    console.log("[YouTube翻译] 请在脚本顶部填入 API_KEY");
    $done({ body: originalBody });
    return;
}

var MAX_SEGMENTS = 60;
var SEP = "|||";
var PROMPT = "你是专业字幕翻译员，将带编号的字幕翻译成简体中文。\n格式：编号" + SEP + "译文（一行一条）\n仅输出译文，不加解释。若已是中文原样输出。";

function safeFinish(b) {
    try { $done({ body: b || originalBody }); } catch(e) {}
}

function callApi(texts, cb) {
    var prompt = texts.map(function(t, i) { return i + SEP + t; }).join("\n");
    try {
        $httpClient.post({
            url: apiUrl,
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + apiKey },
            body: JSON.stringify({
                model: model,
                messages: [{ role: "system", content: PROMPT }, { role: "user", content: prompt }],
                temperature: 0.3,
                max_tokens: 2000
            })
        }, function(err, resp, data) {
            try {
                if (err) { console.log("[YouTube翻译] API请求失败: " + err); cb(null); return; }
                var res = JSON.parse(data);
                if (res.error) { console.log("[YouTube翻译] API错误: " + res.error.message); cb(null); return; }
                if (!res.choices || !res.choices[0]) { cb(null); return; }
                var dict = {};
                res.choices[0].message.content.trim().split("\n").forEach(function(line) {
                    var si = line.indexOf(SEP);
                    if (si > 0) {
                        var idx = parseInt(line.substring(0, si).trim(), 10);
                        var txt = line.substring(si + SEP.length).trim();
                        if (!isNaN(idx) && txt) dict[idx] = txt;
                    }
                });
                cb(dict);
            } catch(e) { console.log("[YouTube翻译] 解析失败: " + e); cb(null); }
        });
    } catch(e) { console.log("[YouTube翻译] 请求异常: " + e); cb(null); }
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
                if (!dict || Object.keys(dict).length === 0) { safeFinish(originalBody); return; }
                var result = body, offset = 0;
                segments.forEach(function(seg, idx) {
                    if (dict[idx] !== undefined) {
                        var newText = encodeXml(dict[idx]);
                        var start = seg.pos + offset + seg.openTag.length;
                        var end = start + seg.raw.length;
                        result = result.substring(0, start) + newText + result.substring(end);
                        offset += newText.length - seg.raw.length;
                    }
                });
                console.log("[YouTube翻译] 完成，共翻译 " + Object.keys(dict).length + " 条");
                safeFinish(result);
            } catch(e) { console.log("[YouTube翻译] XML替换异常: " + e); safeFinish(originalBody); }
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
                    var sg = ev.segs[j];
                    if (sg.utf8 && sg.utf8.trim() && sg.utf8.trim() !== "\n") {
                        texts.push(sg.utf8.replace(/\n/g, " ").trim());
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
                if (!dict || Object.keys(dict).length === 0) { safeFinish(originalBody); return; }
                var count = 0;
                mapping.forEach(function(mp, idx) {
                    if (dict[idx] !== undefined) { events[mp.ei].segs[mp.si].utf8 = dict[idx]; count++; }
                });
                console.log("[YouTube翻译] 完成，共翻译 " + count + " 条");
                safeFinish(JSON.stringify(data));
            } catch(e) { console.log("[YouTube翻译] JSON替换异常: " + e); safeFinish(originalBody); }
        });
    }

} catch(e) {
    console.log("[YouTube翻译] 顶层异常: " + e);
    safeFinish(originalBody);
}
