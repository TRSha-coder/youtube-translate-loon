/**
 * YouTube 字幕格式转换脚本 (Loon)
 * 将字幕请求格式从 srv3 (XML) 改为 json3 (JSON)，以便后续翻译脚本解析
 * 版本: 1.0
 */

let url = $request.url;

// 将请求格式从 srv3/vtt 改为 json3
url = url.replace(/format=srv3/g, "format=json3");
url = url.replace(/format=vtt/g, "format=json3");

$done({ url: url });
