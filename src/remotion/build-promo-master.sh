#!/usr/bin/env bash
# Master de audio del promo wellness (voz +5dB con limiter maestro → sin clipping).
# La voz a +5dB hace que la mezcla pase de 0dBFS; Remotion no tiene limiter maestro,
# así que la mezcla final se arma en ffmpeg (replicando los tiempos de los beats) con
# un alimiter maestro, y se muxea al VIDEO renderizado por Remotion.
#
# Uso: 1) npx remotion render src/remotion/Root.tsx PromoWellness video.mp4 --codec=h264
#      2) bash src/remotion/build-promo-master.sh video.mp4 final.mp4
set -euo pipefail
FF=node_modules/ffmpeg-static/ffmpeg
PR=public/promo
VIDEO="${1:?video.mp4}"; OUT="${2:?final.mp4}"

# 1) Voz Skye +5dB (desde los mp3 en cache; NO regenera con Higgsfield).
#    loudnorm base -13 (volumen parejo entre clips) + volume +5dB + alimiter.
# for k in hook caos reveal glp nutri bien vida priv cta; do
#   "$FF" -y -i "cache/$k.mp3" -af "atempo=1.12,loudnorm=I=-13:TP=-1:LRA=11,volume=5dB,alimiter=limit=0.95" -ar 48000 -ac 2 "$PR/d-$k.wav"
# done

# 2) Mezcla maestra: música 0.34 + voz (tiempos de beats) + whoosh×9 + ding, alimiter maestro 0.95.
#    Delays (ms) = inicio de cada beat @30fps: hook0 caos7600 reveal14900 glp16900 nutri22600 bien27300 vida31300 priv37000 cta41000; ding 15033.
"$FF" -y -i "$PR/music.wav" \
 -i "$PR/d-hook.wav" -i "$PR/d-caos.wav" -i "$PR/d-reveal.wav" -i "$PR/d-glp.wav" -i "$PR/d-nutri.wav" -i "$PR/d-bien.wav" -i "$PR/d-vida.wav" -i "$PR/d-priv.wav" -i "$PR/d-cta.wav" \
 -i "$PR/whoosh.wav" -i "$PR/whoosh.wav" -i "$PR/whoosh.wav" -i "$PR/whoosh.wav" -i "$PR/whoosh.wav" -i "$PR/whoosh.wav" -i "$PR/whoosh.wav" -i "$PR/whoosh.wav" -i "$PR/whoosh.wav" \
 -i "$PR/ding.wav" \
 -filter_complex "[0]volume=0.34[m];\
[1]adelay=0|0[v0];[2]adelay=7600|7600[v1];[3]adelay=14900|14900[v2];[4]adelay=16900|16900[v3];[5]adelay=22600|22600[v4];[6]adelay=27300|27300[v5];[7]adelay=31300|31300[v6];[8]adelay=37000|37000[v7];[9]adelay=41000|41000[v8];\
[10]adelay=0|0,volume=0.6[w0];[11]adelay=7600|7600,volume=0.6[w1];[12]adelay=14900|14900,volume=0.6[w2];[13]adelay=16900|16900,volume=0.6[w3];[14]adelay=22600|22600,volume=0.6[w4];[15]adelay=27300|27300,volume=0.6[w5];[16]adelay=31300|31300,volume=0.6[w6];[17]adelay=37000|37000,volume=0.6[w7];[18]adelay=41000|41000,volume=0.6[w8];\
[19]adelay=15033|15033,volume=0.75[dg];\
[m][v0][v1][v2][v3][v4][v5][v6][v7][v8][w0][w1][w2][w3][w4][w5][w6][w7][w8][dg]amix=inputs=20:normalize=0:dropout_transition=0,alimiter=limit=0.95,atrim=0:45.4[out]" \
 -map "[out]" -ar 48000 -ac 2 /tmp/promo-master.wav

# 3) muxear master al video
"$FF" -y -i "$VIDEO" -i /tmp/promo-master.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 256k -shortest "$OUT"
echo "listo → $OUT"
