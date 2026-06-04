# PMES Pro - API de Redação com Gemini

## Como usar

1. Instale as dependências:

```powershell
npm.cmd install
```

2. Copie `.env.example` e renomeie para `.env`.

3. No `.env`, coloque sua chave do Google AI Studio:

```env
GEMINI_API_KEY=sua_chave_aqui
GEMINI_MODEL=gemini-2.5-flash
PORT=3000
```

4. Rode o servidor:

```powershell
node server.js
```

5. Abra no navegador:

```text
http://localhost:3000
```

Se aparecer "Nota local", veja o erro no PowerShell. Se aparecer resultado sem a observação de fallback, o Gemini respondeu.
