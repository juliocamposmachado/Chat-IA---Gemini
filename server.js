// server.js — RODAR LOCALMENTE APENAS
// Requisitos: node >= 16
const express = require('express');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const { exec, spawn } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const app = express();
app.use(helmet());
app.use(bodyParser.json({ limit: '200kb' }));

const PORT = process.env.PORT || 3001;
const BIND_ADDR = 'https://85cf818df1d7.ngrok-free.app -> http://localhost:3001';
const SECRET = process.env.TERMINAL_TOKEN || 'um-token-muito-forte-que-so-eu-conheco';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// 🔧 Caminho inicial fixo (modifique conforme desejar)
const defaultDir = "C:\\automacao_live\\scripts"; 

// Verifica se o diretório existe; se não, usa o diretório atual
let currentWorkingDir = fs.existsSync(defaultDir) ? defaultDir : process.cwd();

console.log('Terminal PowerShell Integrado - Servidor iniciado');
console.log('Diretório inicial:', currentWorkingDir);
console.log('Sistema operacional:', os.platform());

if (!GEMINI_API_KEY) {
  console.warn('⚠️ Aviso: GEMINI_API_KEY não definida.');
}

// Middleware de autenticação
function checkAuth(req, res, next) {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.slice(7);
  if (token !== SECRET) return res.status(403).json({ error: 'Forbidden' });
  next();
}

// Endpoint: pedir à IA sugestões de comando
app.post('/suggest', checkAuth, async (req, res) => {
  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string') return res.status(400).json({ error: 'Prompt inválido' });

  const systemPrompt = `Você é um assistente que sugere comandos de PowerShell/CLI para executar em um ambiente controlado.
Retorne uma resposta JSON com campo "suggestions": array de objetos { "command": "...", "explanation": "..." }.
Apenas comandos aprovados serão executados manualmente pelo usuário.`;

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(process.env.GEMINI_MODEL || 'gemini-2.0')}:generateContent?key=${GEMINI_API_KEY}`;
    const body = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: prompt }] }],
      temperature: 0.2,
      maxOutputTokens: 512
    };

    const r = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await r.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data).slice(0, 2000);
    res.json({ ok: true, raw: text });
  } catch (err) {
    console.error('Erro /suggest:', err);
    res.status(500).json({ error: 'Erro ao contatar a API Gemini', details: String(err) });
  }
});

// Endpoint: executar comandos PowerShell
app.post('/exec', checkAuth, (req, res) => {
  const { command } = req.body || {};
  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'Comando inválido' });
  }

  const trimmedCmd = command.trim();

  // Comando 'cd'
  if (trimmedCmd.startsWith('cd ')) {
    const newDir = trimmedCmd.substring(3).trim().replace(/['"]/g, '');
    const targetDir = path.isAbsolute(newDir) ? newDir : path.join(currentWorkingDir, newDir);

    try {
      if (fs.existsSync(targetDir) && fs.statSync(targetDir).isDirectory()) {
        currentWorkingDir = path.resolve(targetDir);
        return res.json({
          ok: true,
          stdout: `Diretório alterado para: ${currentWorkingDir}\n`,
          stderr: '',
          cwd: currentWorkingDir
        });
      } else {
        return res.json({
          ok: false,
          stdout: '',
          stderr: `Diretório não encontrado: ${targetDir}\n`,
          cwd: currentWorkingDir
        });
      }
    } catch (err) {
      return res.json({
        ok: false,
        stdout: '',
        stderr: `Erro ao mudar diretório: ${err.message}\n`,
        cwd: currentWorkingDir
      });
    }
  }

  // Comando 'pwd'
  if (trimmedCmd === 'pwd') {
    return res.json({
      ok: true,
      stdout: currentWorkingDir + '\n',
      stderr: '',
      cwd: currentWorkingDir
    });
  }

  const isWindows = os.platform() === 'win32';
  const shell = isWindows ? 'powershell.exe' : 'bash';
  const shellArgs = isWindows ? ['-Command', trimmedCmd] : ['-c', trimmedCmd];

  console.log(`Executando: ${trimmedCmd}`);
  console.log(`Diretório: ${currentWorkingDir}`);

  const child = spawn(shell, shellArgs, {
    cwd: currentWorkingDir,
    timeout: 30000,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: '0' }
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (data) => { stdout += data.toString(); });
  child.stderr.on('data', (data) => { stderr += data.toString(); });

  child.on('close', (code) => {
    console.log(`Comando finalizado com código: ${code}`);
    res.json({
      ok: code === 0,
      stdout: stdout || '',
      stderr: stderr || '',
      exitCode: code,
      cwd: currentWorkingDir
    });
  });

  child.on('error', (err) => {
    console.error('Erro ao executar comando:', err);
    res.json({
      ok: false,
      stdout: stdout || '',
      stderr: stderr || err.message,
      error: err.message,
      cwd: currentWorkingDir
    });
  });
});

app.get('/cwd', checkAuth, (req, res) => {
  res.json({ cwd: currentWorkingDir });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    server: 'Chat IA Gemini Terminal Real',
    cwd: currentWorkingDir,
    platform: os.platform(),
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, BIND_ADDR, () => {
  console.log('='.repeat(60));
  console.log('Terminal PowerShell Real - Servidor Online');
  console.log(`URL: https://85cf818df1d7.ngrok-free.app -> http://localhost:3001`);
  console.log(`Token: ${SECRET}`);
  console.log(`Diretório inicial: ${currentWorkingDir}`);
  console.log('='.repeat(60));
});
