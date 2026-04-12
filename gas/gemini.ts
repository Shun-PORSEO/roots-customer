/**
 * Gemini AI連携モジュール (GAS用)
 */

function generateReplyFromGemini(userId: string, userMessage: string, context: any[]): string {
  const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY") || "";
  
  if (!apiKey) {
    return "システムエラー: GASのスクリプトプロパティに GEMINI_API_KEY が設定されていません。";
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  // ユーザーごとのコンテキスト（タスク進捗）を文字列化
  const contextStr = context.length > 0 
    ? context.map(c => `・${c.title} (状況: ${c.is_done ? "完了" : "未完了"})`).join("\n")
    : "（まだ初回のシステム登録が行われていないか、タスクが存在しません）";

  // システムインストラクション（基本プロンプト）
  const systemInstruction = {
    parts: [{
      text: `あなたは結婚式準備の専属プランナー「Roots AIアシスタント」です。
明るく丁寧で、絵文字を使いつつ親身なトーンで回答してください！

【重要: 今話している顧客の現在のタスク状況（リアルタイムデータ）】
${contextStr}
この人はあなたのお客様です。上記の状況に合わせて、必要に応じて「〇〇のタスクはまだですね、一緒に頑張りましょう！」などの声掛けを行ってください。

【基本マニュアル内容】
1. 招待状の準備: 挙式3ヶ月前までにリストアップ完了、2ヶ月前発送。
2. 席次表: 挙式1ヶ月前までに確定させる。
3. BGM: 著作権のため市販の原盤CDが必要（録画やコピーは不可）。
4. 引き出物: ご祝儀額の1〜2割が相場です。
`
    }]
  };

  const payload = {
    system_instruction: systemInstruction,
    contents: [
      {
        role: "user",
        parts: [{ text: userMessage }]
      }
    ]
  };

  const options: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());

    if (data.error) {
      console.error("Gemini API Error", data.error);
      return "クラウドAIとの通信中にエラーが発生しました。時間を置いてお試しください。";
    }

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      return data.candidates[0].content.parts[0].text;
    }
  } catch (err: any) {
    console.error("Fetch Error:", err);
  }

  return "申し訳ありません、現在AIの呼び出しに失敗しております。";
};
