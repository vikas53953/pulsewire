export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // DB first — everything below (and every request) reads it synchronously.
    const { initSqlDb } = await import("./lib/sqldb");
    await initSqlDb();
    if (process.env.VERCEL) {
      // Serverless: no long-lived process — request-driven SWR does warming.
      return;
    }
    const { startBackgroundWarmer } = await import("./lib/warmer");
    startBackgroundWarmer();
    const { startRadarPoller } = await import("./lib/radar");
    startRadarPoller();
  }
}
