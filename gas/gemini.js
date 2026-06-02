/**
 * Gemini AI連携モジュール (GAS用)
 */

/**
 * エラーコードに応じた日本語メッセージを返す
 */
function _getGeminiErrorMessage(errorCode, errorMessage) {
    if (errorCode === 400) {
        return "リクエストの形式が正しくありません（400）。APIキーまたは入力内容を確認してください。";
    }
    if (errorCode === 401 || errorCode === 403) {
        return "APIキーが無効または権限がありません（" + errorCode + "）。GASのスクリプトプロパティの GEMINI_API_KEY を確認してください。";
    }
    if (errorCode === 404) {
        return "指定したモデルが見つかりません（404）。モデル名を確認してください。";
    }
    if (errorCode === 429) {
        return "APIのリクエスト制限に達しました（429）。しばらく時間をおいてからお試しください。";
    }
    if (errorCode === 500 || errorCode === 503) {
        return "Gemini サーバー側でエラーが発生しています（" + errorCode + "）。時間をおいてお試しください。";
    }
    return "Gemini APIエラー（" + errorCode + "）: " + (errorMessage || "不明なエラー");
}

function generateReplyFromGemini(userId, userMessage, context) {
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
    const options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };
    try {
        const response = UrlFetchApp.fetch(url, options);
        const statusCode = response.getResponseCode();
        const data = JSON.parse(response.getContentText());
        if (data.error) {
            const msg = _getGeminiErrorMessage(data.error.code || statusCode, data.error.message);
            console.error("Gemini API Error [" + statusCode + "]:", data.error);
            return msg;
        }
        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            return data.candidates[0].content.parts[0].text;
        }
        if (data.candidates && data.candidates[0] && data.candidates[0].finishReason) {
            console.error("Gemini blocked:", data.candidates[0].finishReason);
            return "AIが回答を生成できませんでした（" + data.candidates[0].finishReason + "）。別の内容でお試しください。";
        }
    }
    catch (err) {
        console.error("Fetch Error:", err);
        return "通信エラーが発生しました: " + err.message;
    }
    return "申し訳ありません、現在AIの呼び出しに失敗しております。";
}

/**
 * Gemini API の接続・設定を診断する関数。
 * GASエディタの「実行」ボタンから直接呼び出してください。
 * 実行結果は「実行ログ」タブで確認できます。
 */
function debugGeminiAPI() {
    const results = [];

    // 1. APIキーの確認
    const apiKey = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY") || "";
    if (!apiKey) {
        results.push("❌ GEMINI_API_KEY が未設定です。スクリプトプロパティに追加してください。");
        console.log(results.join("\n"));
        return results;
    }
    results.push("✅ GEMINI_API_KEY が設定されています（先頭4文字: " + apiKey.substring(0, 4) + "...）");

    // 2. テストリクエスト送信
    const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey;
    const payload = {
        contents: [{ role: "user", parts: [{ text: "テスト。「OK」とだけ返してください。" }] }]
    };
    const options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
    };

    let statusCode, data;
    try {
        const response = UrlFetchApp.fetch(url, options);
        statusCode = response.getResponseCode();
        data = JSON.parse(response.getContentText());
    } catch (err) {
        results.push("❌ 通信エラー: " + err.message);
        console.log(results.join("\n"));
        return results;
    }

    results.push("📡 HTTPステータス: " + statusCode);

    // 3. エラーレスポンスの解析
    if (data.error) {
        results.push("❌ APIエラー: " + _getGeminiErrorMessage(data.error.code || statusCode, data.error.message));
        results.push("   詳細: code=" + data.error.code + " status=" + data.error.status + " message=" + data.error.message);
        console.log(results.join("\n"));
        return results;
    }

    // 4. 正常レスポンスの確認
    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const reply = data.candidates[0].content.parts[0].text;
        results.push("✅ Gemini API 正常応答: \"" + reply.trim() + "\"");
    } else {
        results.push("⚠️ 予期しないレスポンス形式: " + JSON.stringify(data).substring(0, 200));
    }

    // 5. LINE_CHANNEL_ACCESS_TOKEN の確認（webhook連携用）
    const lineToken = PropertiesService.getScriptProperties().getProperty("LINE_CHANNEL_ACCESS_TOKEN") || "";
    if (!lineToken) {
        results.push("⚠️ LINE_CHANNEL_ACCESS_TOKEN が未設定です（LINE連携が必要な場合は設定してください）。");
    } else {
        results.push("✅ LINE_CHANNEL_ACCESS_TOKEN が設定されています（先頭4文字: " + lineToken.substring(0, 4) + "...）");
    }

    console.log(results.join("\n"));
    return results;
}
;
