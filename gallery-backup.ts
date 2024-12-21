import { $, file } from "bun";
import { mkdir } from "fs/promises";
import { join } from "path";

async function ensureDeviceConnected(): Promise<boolean> {
  const devices = await $`adb devices`;
  return devices.stdout.toString().split('\n').length > 2;
}

async function createBackupDirectory(): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = join(process.cwd(), 'backups', `gallery_${timestamp}`);
  await mkdir(backupDir, { recursive: true });
  return backupDir;
}

async function pullGalleryContent(backupDir: string) {
  console.log("📷 Pulling gallery content...");
  
  
  const galleryPaths = [
    "/sdcard/DCIM/Camera",
    "/sdcard/Pictures",
    "/sdcard/Movies"
  ];

  for (const path of galleryPaths) {
    try {
      console.log(`\n🔄 Checking ${path}...`);
      const result = await $`adb pull ${path} ${backupDir}`;
      console.log(result.stdout.toString());
    } catch (error) {
      console.warn(`⚠️ Could not access ${path}: ${error}`);
    }
  }
}

async function main() {
  console.log("🔄 WearOS Gallery Backup Script");
  console.log("------------------------------\n");
  
  
  if (!await ensureDeviceConnected()) {
    console.error("❌ No WearOS device connected! Please connect a device first.");
    process.exit(1);
  }

  try {
    const backupDir = await createBackupDirectory();
    console.log(`📁 Created backup directory: ${backupDir}`);
    
    await pullGalleryContent(backupDir);
    
    console.log("\n✅ Backup completed successfully!");
    console.log(`💾 Files saved to: ${backupDir}`);
  } catch (error) {
    console.error("❌ Backup failed:", error);
    process.exit(1);
  }
}

main().catch(console.error);
