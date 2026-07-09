export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startBackgroundWarmer } = await import("./lib/warmer");
    startBackgroundWarmer();
  }
}
