import { $ } from "bun";
import { mkdir } from "fs/promises";
import { join } from "path";

const BACKUP_DIR = "./wearos-backups";
const DATE_STRING = new Date().toISOString().split("T")[0];

async function getConnectedDevices() {
  try {
    const result = await $`adb devices`;
    const lines = result.stdout.toString().split("\n");
    return lines
      .slice(1)
      .filter((line) => line.trim().length > 0)
      .map((line) => line.split("\t")[0]);
  } catch (error) {
    console.error("Error getting devices:", error);
    return [];
  }
}

async function getInstalledPackages(deviceId: string) {
  try {
    const result = await $`adb -s ${deviceId} shell pm list packages -f`;
    return result.stdout
      .toString()
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const match = line.match(/package:(.+)=(.+)/);
        return match ? { path: match[1], packageName: match[2] } : null;
      })
      .filter((pkg) => pkg !== null);
  } catch (error) {
    console.error("Error getting packages:", error);
    return [];
  }
}

async function backupApk(
  deviceId: string,
  apkPath: string,
  packageName: string
) {
  try {
    const backupPath = join(BACKUP_DIR, DATE_STRING, packageName);
    await mkdir(backupPath, { recursive: true });

    const outputPath = join(backupPath, `${packageName}.apk`);
    await $`adb -s ${deviceId} pull ${apkPath} ${outputPath}`;

    console.log(`✅ Backed up ${packageName}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to backup ${packageName}:`, error);
    return false;
  }
}

async function main() {
  console.log("📱 Starting WearOS APK backup...");
  console.log(`Started by: ${process.env.USER || "codingstark-dev"}`);
  console.log(`Time: ${new Date().toUTCString()}\n`);

  await mkdir(BACKUP_DIR, { recursive: true });

  const devices = await getConnectedDevices();

  if (devices.length === 0) {
    console.error("❌ No devices found. Please connect your WearOS device.");
    process.exit(1);
  }

  for (const deviceId of devices) {
    console.log(`\n📲 Processing device: ${deviceId}`);

    const packages = await getInstalledPackages(deviceId);
    console.log(`Found ${packages.length} packages`);

    let successCount = 0;

    for (const pkg of packages) {
      if (!pkg) continue;
      const success = await backupApk(deviceId, pkg.path, pkg.packageName);
      if (success) successCount++;
    }

    console.log(`\n✨ Backup complete for device ${deviceId}`);
    console.log(
      `Successfully backed up ${successCount}/${packages.length} APKs`
    );
  }

  console.log("\n🎉 All backups completed!");
}

main().catch(console.error);
