async function main(): Promise<boolean> {
  const baseUrl = process.argv[2] ?? 'http://127.0.0.1:39004';
  const day = process.argv[3] ?? '2025-11-01';
  const routes = ['/', '/month/2025-11', `/day/${day}`];

  let failed = false;
  for (const route of routes) {
    const url = new URL(route, baseUrl).toString();
    let status: number | string;
    try {
      status = (await fetch(url)).status;
    } catch (err) {
      status = String(err);
    }
    const ok = status === 200;
    if (!ok) failed = true;
    console.log(`${ok ? 'OK ' : 'FAIL'} ${status} ${url}`);
  }
  return failed;
}

main().then((failed) => process.exit(failed ? 1 : 0));
