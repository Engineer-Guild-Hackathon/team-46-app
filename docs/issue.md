目的
ユーザーが途中から再開した際に過去に分からなかったと選択したものを確認できるように。

提案内容
localstorageでsentencesを保存し、
sentencesには過去のリクエストで来た文を保存し、追加でclickedWordIndexとsentenceClickedを追加する。
sentencesのstructureは以下の通り。
type -> subtitleまたはtext
sentenceNo -> integer, 原文のsentenceNoである点に注意。重複する場合がある 詳しくは\*1
en -> string, 文のテキスト
jp -> string, 文の日本語翻訳
jp_word -> string[], 文の書く単語に紐付けされた日本語
clickedWordIndex -> integer[],クリックされた単語のindex. 0-index.
sentenceClicked -> boolean, このsentenceがクリックされたか。

\*1 #25 に書いた通りAPIから原文一文に対して複数文が対応する場合がある。
sentencesには\nで区切った各文を分けて収納するため、sentenceNoは NOT uniqueである点に注意。

ゴール
ユーザーが一度読むのを中断し、戻ってきた際に現状成果を残したままにできる。
