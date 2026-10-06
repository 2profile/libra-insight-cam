# Datasets

Organizacao para arquivos exportados pela tela `/coletar`.

## Pastas

- `raw/`: arquivos recebidos de colegas, ainda sem validar.
- `approved/`: arquivos validados e usados no treino.
- `rejected/`: arquivos com label errado, frames faltando ou landmarks quebrados.

## Nome recomendado

Use este padrao:

```txt
LETRA-nome-AAAA-MM-DD.json
```

Exemplos:

```txt
A-ryan-2026-06-16.json
B-maria-2026-06-16.json
L-joao-2026-06-16.json
```

## Fluxo

1. Coloque novos arquivos em `datasets/raw/`.
2. Rode `npm run validate:landmarks -- datasets/raw`.
3. Mova arquivos bons para `datasets/approved/`.
4. Rode `npm run train:landmarks -- datasets/approved/*.json`.

Letras com movimento (J, Z): grave o gesto completo nos 90 frames (~3s). JSON antigo de 30 frames continua válido. Pose parada não treina o path.

Arquivos em `Downloads/` tambem podem ser validados diretamente.
