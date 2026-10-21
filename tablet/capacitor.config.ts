import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.pickleball.desk",
  appName: "Pickleball Desk",
  webDir: "dist",
  // The tablet's data lives in IndexedDB, which belongs to this origin. Pin it so a
  // Capacitor default change can never strand players and sessions after an update.
  server: {
    androidScheme: "https",
    hostname: "localhost",
  },
};

export default config;
