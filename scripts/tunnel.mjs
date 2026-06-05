#!/usr/bin/env node
// Sobe um quick tunnel do Cloudflare apontando para o servidor local e imprime o
// link de teste pronto (dominio publico fixo + ?server=<url-do-tunnel>).
//
// Uso:
//   npm run tunnel                 # porta 4173, frontend padrao
//   PORT=5000 npm run tunnel       # outra porta do backend
//   FRONTEND_URL=https://meu.site npm run tunnel
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");

const PORT = process.env.PORT ?? "4173";
const FRONTEND_URL = (process.env.FRONTEND_URL ?? "https://oikosdigital.com.br").replace(/\/$/, "");

// Prefere o binario versionado em .tools; cai para o cloudflared do PATH.
const localBin = join(repoRoot, ".tools", process.platform === "win32" ? "cloudflared.exe" : "cloudflared");
const bin = existsSync(localBin) ? localBin : "cloudflared";

// --protocol http2 forca o transporte TCP (HTTP/2) em vez de QUIC/UDP. Em redes
// que bloqueiam/instabilizam UDP (7844), o QUIC falha com "control stream
// encountered a failure" e o tunnel nunca conecta. Pode ser sobrescrito por env.
const protocol = process.env.TUNNEL_PROTOCOL ?? "http2";

const child = spawn(
  bin,
  ["tunnel", "--url", `http://localhost:${PORT}`, "--protocol", protocol, "--no-autoupdate"],
  {
    stdio: ["ignore", "pipe", "pipe"]
  }
);

let printed = false;
const urlRe = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

function scan(chunk) {
  const text = chunk.toString();
  process.stderr.write(text); // repassa o log do cloudflared
  if (printed) return;
  const match = text.match(urlRe);
  if (!match) return;
  printed = true;
  const tunnel = match[0];
  const link = `${FRONTEND_URL}/?server=${tunnel}`;
  const line = "=".repeat(Math.max(link.length, 40) + 4);
  process.stdout.write(
    `\n${line}\n` +
      `  Tunnel:  ${tunnel}  ->  http://localhost:${PORT}\n` +
      `  Link de teste (compartilhe este):\n` +
      `  ${link}\n` +
      `${line}\n\n` +
      `  Mantenha este processo e o servidor (npm run dev:server) abertos.\n` +
      `  Quick tunnel: a URL muda toda vez que voce reinicia.\n\n`
  );
}

child.stdout.on("data", scan);
child.stderr.on("data", scan);

child.on("exit", (code) => process.exit(code ?? 0));

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    child.kill();
    process.exit(0);
  });
}
