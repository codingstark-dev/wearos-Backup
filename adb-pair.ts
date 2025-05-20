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
    // Enhanced error message for failing to get IP automatically
    console.error(
      "\n⚠️ Could not automatically detect the watch's IP address."
    );
    console.error(
      "   Please ensure your watch is connected to Wi-Fi and ADB debugging is enabled."
    );
    console.error(
      "   You might also need to have the watch connected via USB temporarily for the 'adb shell' command to work."
    );
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
    // Parse and display devices in a cleaner format
    const deviceOutput = devices.stdout.toString().trim();
    const deviceLines = deviceOutput.split("\n").slice(1); // Skip the "List of devices attached" line
    if (deviceLines.length === 0 || (deviceLines.length === 1 && deviceLines[0].trim() === "")) {
      console.log("No devices found.");
    } else {
      deviceLines.forEach((line) => {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          console.log(`- Device ID: ${parts[0]} - Status: ${parts[1]}`);
        } else if (line.trim() !== "") {
          console.log(`- ${line.trim()}`); // Fallback for unexpected format
        }
      });
    }
  } catch (error) {
    console.error(
      "❌ Error checking devices. Please ensure ADB is installed and in your PATH."
    );
    console.error(
      "   Make sure developer options and USB/Wi-Fi debugging are enabled on your device(s)."
    );
    // It might be prudent to exit here if ADB is not working at all,
    // or offer to proceed with manual IP entry. For now, let's allow proceeding.
  }

  let ipAddress = await getWifiIPAddress();
  // Input validation for IP address
  const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
  while (!ipAddress || !ipRegex.test(ipAddress)) {
    if (ipAddress && !ipRegex.test(ipAddress)) {
      console.log("❌ Invalid IP address format. Please use IPv4 format (e.g., 192.168.1.100).");
    }
    ipAddress = await question(
      "➡️ Enter your watch's IP address (shown in watch's Developer options, ensure it's on the same Wi-Fi network as this computer): "
    );
  }

  // Input validation for port
  let port: string | number = ""; // Changed to let for reassignment
  let portNum = 0; // Variable to store the parsed port number
  while (true) {
    port = await question(
      "➡️ Enter the pairing port (shown in watch's Developer options, ensure it's on the same Wi-Fi network): "
    );
    portNum = parseInt(port, 10);
    if (!isNaN(portNum) && portNum > 0 && portNum <= 65535) {
      break; // Exit loop if port is valid
    }
    console.log("❌ Invalid port number. Please enter a number between 1 and 65535.");
  }

  console.log("\n⚠️ Please check your WearOS watch and accept any pairing prompts that appear.");
  console.log("   You will then be shown a 6-digit pairing code on your watch.");
  const pairingCode = await question(
    "Enter the 6-digit pairing code shown on your watch: "
  );

  // Validate pairing code (already good)
  if (pairingCode.length !== 6 || !/^\d+$/.test(pairingCode)) {
    console.error("❌ Invalid pairing code! Must be 6 digits.");
    readline.close(); // Close readline before exiting
    process.exit(1);
  }

  try {
    console.log(`\n🔄 Attempting to pair with ${ipAddress}:${portNum}...`);
    // Provide guidance for pairing
    const pairResult = await $`adb pair ${ipAddress}:${portNum} ${pairingCode}`;
    if (pairResult.exitCode !== 0) {
      console.error(`❌ Pairing failed. Exit code: ${pairResult.exitCode}`);
      console.error("   Output:", pairResult.stderr.toString() || pairResult.stdout.toString());
      console.error("   Please double-check the IP address, port, and pairing code.");
      console.error("   Ensure the watch and computer are on the same Wi-Fi network.");
      console.error("   Also, make sure you accepted the pairing prompt on your watch.");
    } else {
      console.log("✅ Pairing successful!");
      console.log(pairResult.stdout.toString().trim()); // Trim output

      // Attempt to connect to the standard debugging port 5555
      console.log(`\n🔄 Attempting to connect to ${ipAddress}:5555 for debugging...`);
      const connectResult = await $`adb connect ${ipAddress}:5555`;
      if (connectResult.exitCode !== 0) {
        console.error(`❌ Connection to ${ipAddress}:5555 failed. Exit code: ${connectResult.exitCode}`);
        console.error("   Output:", connectResult.stderr.toString() || connectResult.stdout.toString());
        console.error("   Your device might be paired but not connected for debugging.");
        console.error("   You may need to run 'adb connect <IP_ADDRESS>:5555' manually or check your watch's connection.");
      } else {
        console.log("✅ Connection successful!");
        console.log(connectResult.stdout.toString().trim()); // Trim output
      }
    }

    // Display final list of devices
    console.log("\n📋 Final device list after attempting pairing and connection:");
    const finalDevices = await $`adb devices`;
    const finalDeviceOutput = finalDevices.stdout.toString().trim();
    const finalDeviceLines = finalDeviceOutput.split("\n").slice(1);
    if (finalDeviceLines.length === 0 || (finalDeviceLines.length === 1 && finalDeviceLines[0].trim() === "")) {
      console.log("No devices found.");
    } else {
      finalDeviceLines.forEach((line) => {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          console.log(`- Device ID: ${parts[0]} - Status: ${parts[1]}`);
        } else if (line.trim() !== "") {
          console.log(`- ${line.trim()}`);
        }
      });
    }
  } catch (error: any) {
    // General error handling for pairing/connection process
    console.error("❌ An error occurred during the pairing or connection process.");
    if (error.stderr) {
      console.error("   Error details:", error.stderr.toString());
    } else if (error.stdout) {
      console.error("   Output:", error.stdout.toString());
    } else {
      console.error("   Error:", error.message || error);
    }
    console.error(
      "   Please check your ADB setup, network connection, and device status."
    );
  } finally {
    readline.close();
  }
}

// Main execution block with enhanced error reporting
main().catch((error) => {
  console.error("❌ An unexpected script error occurred:", error);
  readline.close(); // Ensure readline is closed on unexpected errors
  process.exit(1);
});
