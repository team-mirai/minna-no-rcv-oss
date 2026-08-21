# サンプル画像のクレジット

トップページ FV のライブ開票デモ（`src/features/top/LiveTallyDemo.tsx`）で
「卒業旅行の行き先」候補のサムネイルとして使っている画像。

すべて [Unsplash License](https://unsplash.com/license)（商用利用可・帰属表示は不要）
の写真を、表示サイズ 44px の 2倍（88×88）に切り抜いて WebP へ変換したもの。
帰属は License 上は不要だが、出典をたどれるようここに記録する。

| ファイル | 用途 | 撮影 | 出典 |
| --- | --- | --- | --- |
| `fuji.webp` | 弾丸富士山 | Justin Buisson | https://unsplash.com/photos/vIluu0IH6Ps |
| `onsen.webp` | 箱根温泉 | Romeo A. | https://unsplash.com/photos/8X3IMf4W8Ew |
| `beach.webp` | 沖縄ビーチ | Elizeu Dias | https://unsplash.com/photos/xarhNpLSHTk |
| `camp.webp` | 高原キャンプ | Victor Larracuente | https://unsplash.com/photos/JQfYGhUcDSg |

写真はいずれも実在の場所を写したものではなく、候補名（富士山・箱根 など）とは
一致しない。デモの雰囲気づくり用の素材であり、地名の記録ではない。

## 差し替えるとき

44px 表示なので 88×88 に切り出せば十分（1枚 1〜2KB）。

```bash
magick <元画像> -auto-orient -resize 88x88^ -gravity center -extent 88x88 \
  -strip -quality 78 public/samples/<名前>.webp
```
