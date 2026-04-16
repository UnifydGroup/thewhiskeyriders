import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';

const MARKER = '-- @auto-migrate';

function getProjectRef(url) {
  try {
    const hostname = new URL(url).hostname;
    const [ref] = hostname.split('.');
    return ref || null;
  } catch {
    return null;
  }
}

async function loadEnvFileIfExists(filePath) {
  try {
    await access(filePath);
  } catch {
    return;
  }

  const content = await readFile(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) continue;

    let value = trimmed.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

async function runQuery({ ref, token, query }) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase query failed (${response.status}): ${text}`);
  }
}

function isLikelyDependencyOrderError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('42P01') || // undefined_table
    message.includes('42703') || // undefined_column
    message.includes('2BP01') || // dependent_objects_still_exist
    (message.toLowerCase().includes('does not exist') &&
      (message.toLowerCase().includes('relation') || message.toLowerCase().includes('column')))
  );
}

async function main() {
  const cwd = process.cwd();
  await loadEnvFileIfExists(path.join(cwd, '.env.local'));
  await loadEnvFileIfExists(path.join(cwd, '.env'));

  const migrationsDir = path.join(cwd, 'migrations');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const accessToken =
    process.env.SUPABASE_ACCESS_TOKEN || process.env.SUPABASE_MANAGEMENT_TOKEN || '';
  const ref = supabaseUrl ? getProjectRef(supabaseUrl) : null;

  if (!supabaseUrl || !ref) {
    console.log('[migrations] Skipping: NEXT_PUBLIC_SUPABASE_URL is missing or invalid.');
    return;
  }
  if (!accessToken) {
    console.log(
      '[migrations] Skipping: SUPABASE_ACCESS_TOKEN is not set. Add it to enable automatic migration apply.'
    );
    return;
  }

  const files = (await readdir(migrationsDir))
    .filter((name) => name.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const autoMigrations = [];
  for (const file of files) {
    const fullPath = path.join(migrationsDir, file);
    const sql = await readFile(fullPath, 'utf8');
    if (!sql.includes(MARKER)) continue;
    autoMigrations.push({ file, sql });
  }

  let applied = 0;
  let pending = [...autoMigrations];
  while (pending.length > 0) {
    const deferred = [];
    let progressed = false;

    for (const migration of pending) {
      try {
        console.log(`[migrations] Applying ${migration.file}`);
        await runQuery({ ref, token: accessToken, query: migration.sql });
        applied += 1;
        progressed = true;
      } catch (error) {
        if (isLikelyDependencyOrderError(error) && pending.length > 1) {
          console.log(
            `[migrations] Deferring ${migration.file} (dependency not ready yet, will retry)`
          );
          deferred.push(migration);
          continue;
        }
        throw error;
      }
    }

    if (!progressed && deferred.length > 0) {
      const names = deferred.map((migration) => migration.file).join(', ');
      throw new Error(`Could not resolve migration dependencies automatically. Pending: ${names}`);
    }

    pending = deferred;
  }

  if (applied === 0) {
    console.log('[migrations] No auto-migrate files found.');
    return;
  }

  console.log(`[migrations] Applied ${applied} migration(s).`);
}

main().catch((error) => {
  console.error('[migrations] Failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
