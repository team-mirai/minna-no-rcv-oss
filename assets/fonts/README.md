# assets/fonts

OG 画像（`next/og` = satori）を描くための日本語フォント。ブラウザには配信しない
（Web フォントは `layout.tsx` の Google Fonts 側。ここはサーバ側の画像生成専用）。

## NotoSansJP-Bold-subset.ttf

- 元フォント: Noto Sans JP Bold (v56) — SIL Open Font License 1.1
  https://fonts.google.com/noto/specimen/Noto+Sans+JP
- **ライセンス本文: [`OFL.txt`](OFL.txt)**（OFL 1.1 条項 2 が、再配布するコピーに
  ライセンス本文を含めることを求めているため同梱している）。リポジトリ全体の
  AGPL-3.0 はこのフォントには及ばない。
- 収録: cp932（JIS X 0208 + NEC/IBM 拡張）の全文字 + ASCII + ラテン1 +
  一般句読点 + 全角/半角形。約 9,400 字。日常の日本語のお題タイトルはほぼ網羅する。
- サブセット理由: 原本は 5.3MB あり、サーバレス関数に丸ごと載せるには重い。
  上記範囲に絞って 2.4MB。

再生成する場合（`pip install fonttools` が必要）:

```sh
# 1. 元 TTF を取得（css2 API に古い UA を渡すと woff2 でなく ttf の URL が返る）
curl -sA "Mozilla/4.0" "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700"
curl -sLo /tmp/NotoSansJP-Bold.ttf "<上で返った .ttf の URL>"

# 2. cp932 の収録文字を Unicode コードポイント一覧に落とす
python3 -c "
cps=set()
for b1 in list(range(0x81,0xa0))+list(range(0xe0,0xfd)):
    for b2 in range(0x40,0xfd):
        try: ch=bytes([b1,b2]).decode('cp932')
        except Exception: continue
        if len(ch)==1: cps.add(ord(ch))
for b in range(0x20,0x7f): cps.add(b)
for b in range(0xa1,0xe0): cps.add(ord(bytes([b]).decode('cp932')))
open('/tmp/jis.txt','w').write(','.join('U+%04X'%c for c in sorted(cps)))
"

# 3. サブセット
pyftsubset /tmp/NotoSansJP-Bold.ttf \
  --output-file=assets/fonts/NotoSansJP-Bold-subset.ttf \
  --unicodes-file=/tmp/jis.txt \
  --unicodes="U+00A0-00FF,U+2000-206F,U+25A0-25FF,U+3000-30FF,U+FF00-FFEF" \
  --layout-features="" --no-hinting --desubroutinize --drop-tables+=DSIG
```

範囲外の文字（絵文字・稀少漢字・ハングル・簡体字など）は豆腐になる。絵文字は
`ImageResponse` の `emoji` オプション側で Twemoji に差し替えている
（`src/features/og/card.tsx`）。
