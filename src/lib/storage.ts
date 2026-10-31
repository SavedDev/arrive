import * as SQLite from 'expo-sqlite';
let db: Promise<SQLite.SQLiteDatabase> | undefined;
function database() {
  if (!db)
    db = SQLite.openDatabaseAsync('arrive.db').then(async (d) => {
      await d.execAsync(
        'PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);',
      );
      return d;
    });
  return db;
}
export async function read<T>(key: string, fallback: T): Promise<T> {
  const row = await (
    await database()
  ).getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
  return row ? (JSON.parse(row.value) as T) : fallback;
}
export async function write<T>(key: string, value: T) {
  await (
    await database()
  ).runAsync(
    'INSERT INTO kv(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    key,
    JSON.stringify(value),
  );
}
export async function remove(key: string) {
  await (await database()).runAsync('DELETE FROM kv WHERE key = ?', key);
}
export async function update<T>(key: string, fallback: T, transform: (value: T) => T): Promise<T> {
  const db = await database();
  let result = fallback;
  await db.withExclusiveTransactionAsync(async (tx) => {
    const row = await tx.getFirstAsync<{ value: string }>(
      'SELECT value FROM kv WHERE key = ?',
      key,
    );
    result = transform(row ? (JSON.parse(row.value) as T) : fallback);
    await tx.runAsync(
      'INSERT INTO kv(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      key,
      JSON.stringify(result),
    );
  });
  return result;
}

export async function clearAll() {
  await (await database()).execAsync('DELETE FROM kv;');
}
export async function removeLegacyData() {
  await (
    await database()
  ).execAsync("DELETE FROM kv WHERE key LIKE 'private:%' OR key = 'push-token';");
}
