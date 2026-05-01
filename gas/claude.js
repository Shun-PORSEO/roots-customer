/**
 * Claude API 連携モジュール (GAS用)
 *
 * GAS は Node.js SDK が使えないため UrlFetchApp で直接 HTTP コール。
 * スクリプトプロパティに CLAUDE_API_KEY を設定すること。
 */
function generateReminderMessage(coupleName, taskName, daysUntil, venueName) {
    const apiKey = PropertiesService.getScriptProperties().getProperty("CLAUDE_API_KEY") || "";
    if (!apiKey) {
        console.error("CLAUDE_API_KEY が未設定です");
        return `${coupleName}様、「${taskName}」の期限まであと${daysUntil}日です。ご確認をお願いいたします。`;
    }
    const payload = {
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        messages: [{
                role: "user",
                content: `ウェディング式場のプランナーとして、カップルへのリマインドメッセージを1通書いてください。
式場名: ${venueName}
カップル名: ${coupleName}様
タスク: ${taskName}
期限まで: ${daysUntil}日

条件: 200文字以内・丁寧語・絵文字1〜2個・式場担当者らしい温かみのある文体`
            }]
    };
    const options = {
        method: "post",
        headers: {
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
    };
    try {
        const response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", options);
        const result = JSON.parse(response.getContentText());
        if (result.error) {
            console.error("Claude API Error:", result.error);
            return `${coupleName}様、「${taskName}」の期限まであと${daysUntil}日です。ご確認をお願いいたします。`;
        }
        if (result.content && result.content[0] && result.content[0].text) {
            return result.content[0].text;
        }
    }
    catch (err) {
        console.error("Claude API Fetch Error:", err);
    }
    return `${coupleName}様、「${taskName}」の期限まであと${daysUntil}日です。ご確認をお願いいたします。`;
}
