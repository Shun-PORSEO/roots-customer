/**
 * LINE Messaging API Webhook モジュール (GAS用)
 */

function replyToLine(replyToken: string, messageText: string) {
  const channelAccessToken = PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN") || "";
  
  if (!channelAccessToken) {
    console.error("LINE_CHANNEL_ACCESS_TOKEN is not set.");
    return;
  }

  const url = "https://api.line.me/v2/bot/message/reply";
  const payload = {
    replyToken: replyToken,
    messages: [
      {
        type: "text",
        text: messageText
      }
    ]
  };

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    contentType: "application/json",
    headers: {
      "Authorization": `Bearer ${channelAccessToken}`
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() !== 200) {
      console.error("LINE Error:", response.getContentText());
    }
  } catch (e: any) {
    console.error("LINE Fetch Error:", e);
  }
};
