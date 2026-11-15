// Ejecutar LOCALMENTE con: node herramientas/generar-hash-admin.mjs
// No envía datos a Internet y no modifica el sitio ni la base de datos.
import { pbkdf2Sync, randomBytes } from 'node:crypto';

function readSecret(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
      reject(new Error('Ejecuta este archivo desde una terminal interactiva (PowerShell/Terminal).'));
      return;
    }
    let input = '';
    process.stdin.setEncoding('utf8');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    // Activa la entrada sin eco antes de imprimir el aviso.
    process.stdout.write(prompt);
    const onData = chunk => {
      for (const char of chunk) {
        if (char === '\u0003' || char === '\u0004') {
          cleanup();
          reject(new Error('Operación cancelada.'));
          return;
        }
        if (char === '\r' || char === '\n') {
          cleanup();
          process.stdout.write('\n');
          resolve(input);
          return;
        }
        if (char === '\u007f' || char === '\b') {
          input = Array.from(input).slice(0, -1).join('');
          continue;
        }
        input += char;
      }
    };
    function cleanup() {
      process.stdin.off('data', onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
    }
    process.stdin.on('data', onData);
  });
}

try {
  const first = await readSecret('Nueva contraseña (no se muestra): ');
  const second = await readSecret('Repite la contraseña (no se muestra): ');
  if (first !== second) throw new Error('Las contraseñas no coinciden.');
  if (first.length < 12 || first.length > 256) throw new Error('Usa entre 12 y 256 caracteres.');
  const salt = randomBytes(16);
  const iterations = 600000;
  const hash = pbkdf2Sync(first, salt, iterations, 32, 'sha256').toString('hex');
  process.stdout.write('\nCopia SOLO este valor en ADMIN_PASSWORD_HASH de Netlify:\n\n');
  process.stdout.write(`pbkdf2-sha256$${iterations}$${salt.toString('hex')}$${hash}\n\n`);
  process.stdout.write('No modifiques ADMIN_USER ni ADMIN_SECRET. Vuelve a desplegar el sitio.\n');
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}

