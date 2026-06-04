# PMES Pro — Simulado com Correção de Redação por IA

## Como rodar localmente

1. Instale o Node.js.
2. Entre nesta pasta pelo terminal.
3. Rode:

```bash
npm install
cp .env.example .env
```

4. Abra o arquivo `.env` e coloque sua chave:

```bash
OPENAI_API_KEY=sua_chave_aqui
```

5. Inicie o servidor:

```bash
npm start
```

6. Acesse:

```bash
http://localhost:3000
```

## Importante

A chave da OpenAI fica apenas no servidor, não no HTML. Isso é essencial para vender o produto com segurança.

Se a API falhar, o app usa uma correção local simples de emergência.
