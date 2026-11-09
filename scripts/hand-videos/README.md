# Vídeos 3D das letras

Gera os clipes de `public/videos/libras/` a partir das gravações em `datasets/approved/`. Usa uma mão 3D com ossos (`generic-hand`, de `@webxr-input-profiles/assets`, licença MIT), Three.js em Chromium headless e ffmpeg.

As dependências ficam nesta pasta, separadas das do site.

## Preparar

```sh
cd scripts/hand-videos
npm install
npm run setup
```

## Gerar uma letra

```sh
npm run solve -- A        # calcula as poses em out/poses
npm run render -- --stills 45,110 A   # imagens de teste em out/stills
npm run render -- A       # MP4 e WebM em out/videos
npm run verify -- A       # MediaPipe + classificador do projeto
```

Letras J e Z usam o gesto gravado. As demais formam o sinal, seguram e giram para mostrar o polegar.

Para publicar:

1. Copie `out/videos/<letra>.mp4` e `.webm` para `public/videos/libras/`.
2. Adicione a letra em `GUIDE_VIDEOS`, em `src/routes/praticar.tsx`.

## Ajustar uma letra

As correções ficam em `SPEC`, no `solve.mjs`. Uma câmera só achata a profundidade e erra dedos escondidos, então quase toda letra precisa delas.

| Campo       | Efeito                                                                                |
| ----------- | ------------------------------------------------------------------------------------- |
| `closed`    | Dedos forçados a fechar                                                               |
| `closedPhi` | Quanto os dedos fechados dobram na base, em graus (padrão 74)                         |
| `parallel`  | Dedos mantidos lado a lado (U)                                                        |
| `thumb`     | `front`: sobre os dedos; `side`: na lateral do indicador; `up`: para cima, na lateral |
| `thumbOver` | Dedo em que o polegar se apoia                                                        |
| `thumbLift` | Altura do polegar acima do dedo, em metros                                            |
| `thumbLock` | Mantém o polegar fixo em relação à palma durante o gesto                              |

`NOSPEC=1 npm run solve -- A` gera a pose sem correções, útil para comparar.

## Referência

Confira a forma de cada letra em um cartão do alfabeto ou com uma pessoa fluente em Libras. As descrições de `src/lib/libras.ts` têm erros, e o `verify` só mede semelhança com os dados de treino: um sinal correto pode receber nota baixa.
