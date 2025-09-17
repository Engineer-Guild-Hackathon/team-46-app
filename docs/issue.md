getTextにdifficultBtn=Trueを難易度を下げるボタンを押した時に追加

また、return formatも変更されているので、それに対応
example:

"text": [
{
"type": "text",
"sentenceNo": 0,
"jp": "アリスは川辺でお姉さんの横に座って、なんにもすることがないのでとても退屈しはじめていました",
"en": "Alice was starting to feel very tired from sitting next to her sister and having nothing to do.",
"en_word": [
"Alice",
"was starting",
"to feel",
"very tired",
"from sitting",
"next to",
"her sister",
"and having",
"nothing to do"
],
"jp_word": [
"アリス",
"はじめていました",
"感じる",
"とても疲れた",
"座って",
"横に",
"お姉さん",
"なんにもすることがないので",
"なんにもすることがない"
],
"word_difficulty": [
"A1",
"B1",
"A2",
"A2",
"A2",
"A2",
"A1",
"B1",
"A2"
],
"is_paragraph_start": true,
"is_paragraph_end": false
