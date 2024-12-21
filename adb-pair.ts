import { $ } from "bun";
import { createInterface } from "readline";

const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    readline.question(query, (answer) => {
      resolve(answer);
    });
  });
}

async function getWifiIPAddress(): Promise<string | null> {
  try {
    const result = await $`adb shell ip -f inet addr show wlan0`;
    const output = result.stdout.toString();
    const match = output.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
    return match ? match[1] : null;
  } catch (error) {
    console.error("Could not get WiFi IP address automatically");
    return null;
  }
}

async function main() {
  console.log("🔄 WearOS Pairing Script");
  console.log("------------------------\n");
  console.log(`Started by: ${process.env.USER || "codingstark-dev"}`);
  console.log(`Time: ${new Date().toUTCString()}\n`);

  try {
    const devices = await $`adb devices`;
    console.log("Currently connected devices:");
    console.log(devices.stdout.toString());
  } catch (error) {
    console.error("Error checking devices:", error);
  }

  let ipAddress = await getWifiIPAddress();
  if (!ipAddress) {
    ipAddress = await question(
      "Enter your watch's IP address (shown in watch's Developer options): "
    );
  }

  const port = await question(
    "Enter the pairing port (shown in watch's Developer options): "
  );

  console.log("\n⚠️ Please check your WearOS watch for the pairing code");
  const pairingCode = await question(
    "Enter the 6-digit pairing code shown on your watch: "
  );

  if (pairingCode.length !== 6 || !/^\d+$/.test(pairingCode)) {
    console.error("❌ Invalid pairing code! Must be 6 digits");
    process.exit(1);
  }

  try {
    console.log(`\n🔄 Attempting to pair with ${ipAddress}:${port}...`);
    const pairResult = await $`adb pair ${ipAddress}:${port} ${pairingCode}`;
    console.log("✅ Pairing successful!");
    console.log(pairResult.stdout.toString());

    console.log("\n🔄 Attempting to connect...");
    const connectResult = await $`adb connect ${ipAddress}:5555`;
    console.log("Connection result:", connectResult.stdout.toString());

    const finalDevices = await $`adb devices`;
    console.log("\nFinal device list:");
    console.log(finalDevices.stdout.toString());
  } catch (error) {
    console.error("❌ Error during pairing:", error);
  }

  readline.close();
}

main().catch((error) => {
  console.error("❌ Script error:", error);
  process.exit(1);
});
