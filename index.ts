
import { Elysia } from "elysia";
import { html } from "@elysiajs/html";
import { staticPlugin } from "@elysiajs/static";
import { $ } from "bun";
import { mkdir } from "fs/promises";
import { join } from "path";

const BACKUP_DIR = "./wearos-backups";
const DATE_STRING = new Date().toISOString().split("T")[0];


const app = new Elysia()
  .use(html())
  .use(staticPlugin({
    assets: 'public',
    prefix: '/public'
  }))
  .get("/", () => indexPage)
  .post("/check-devices", async () => {
    const devices = await getConnectedDevices();
    return deviceList(devices);
  })
  .post("/pair-device", async ({ body }) => {
    const { ipAddress, port, pairingCode } = body as any;
    try {
      await $`adb pair ${ipAddress}:${port} ${pairingCode}`;
      await $`adb connect ${ipAddress}:5555`;
      return `
        <div class="alert alert-success">
          Successfully paired and connected to device!
        </div>
      `;
    } catch (error) {
      return `
        <div class="alert alert-error">
          Failed to pair: ${(error as Error).message}
        </div>
      `;
    }
  })
  .post("/backup", async ({ body }) => {
    const { deviceId } = body as any;
    const packages = await getInstalledPackages(deviceId);
    let progress = 0;

    for (const pkg of packages) {
      if (!pkg) continue;
      await backupApk(deviceId, pkg.path, pkg.packageName);
      progress++;


      const percentage = Math.round((progress / packages.length) * 100);

    }

    return `
      <div class="alert alert-success">
        Backup completed! ${progress} apps backed up.
      </div>
    `;
  })
  .listen(3000);

console.log(
  `🚀 WearOS Backup Server running at http://localhost:${app.server?.port}`
);


const indexPage = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>WearOS Backup Tool</title>
    <script src="https://unpkg.com/htmx.org@1.9.10"></script>
    <link href="https://cdn.jsdelivr.net/npm/daisyui@4.4.24/dist/full.min.css" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-base-200 min-h-screen">
    <div class="container mx-auto p-4">
        <div class="card bg-base-100 shadow-xl">
            <div class="card-body">
                <h1 class="text-2xl font-bold mb-4">📱 WearOS Backup Tool</h1>
                
                <!-- Device Detection -->
                <div class="mb-6">
                    <button class="btn btn-primary"
                            hx-post="/check-devices"
                            hx-target="#deviceList">
                        Check Connected Devices
                    </button>
                    <div id="deviceList" class="mt-4"></div>
                </div>

                <!-- Pairing Form -->
                <div class="mb-6">
                    <h2 class="text-xl font-semibold mb-2">Pair New Device</h2>
                    <form hx-post="/pair-device"
                          hx-target="#pairResult"
                          class="space-y-4">
                        <div class="form-control">
                            <label class="label">IP Address</label>
                            <input type="text" name="ipAddress" 
                                   class="input input-bordered" 
                                   placeholder="192.168.1.100" required>
                        </div>
                        <div class="form-control">
                            <label class="label">Port</label>
                            <input type="text" name="port" 
                                   class="input input-bordered" 
                                   placeholder="50123" required>
                        </div>
                        <div class="form-control">
                            <label class="label">Pairing Code</label>
                            <input type="text" name="pairingCode" 
                                   class="input input-bordered" 
                                   placeholder="123456" required>
                        </div>
                        <button type="submit" class="btn btn-secondary">
                            Pair Device
                        </button>
                    </form>
                    <div id="pairResult" class="mt-4"></div>
                </div>

                <!-- Backup Status -->
                <div id="backupStatus"></div>
            </div>
        </div>
    </div>
</body>
</html>
`;

const deviceList = (devices: string[]) => `
    <div class="card bg-base-200 p-4">
        <h3 class="font-semibold mb-2">Connected Devices:</h3>
        ${
          devices.length === 0
            ? '<p class="text-error">No devices found</p>'
            : `
                <ul class="space-y-2">
                    ${devices
                      .map(
                        (device) => `
                        <li class="flex items-center justify-between">
                            <span>${device}</span>
                            <button class="btn btn-sm btn-primary"
                                    hx-post="/backup"
                                    hx-target="#backupStatus"
                                    hx-vals='{"deviceId": "${device}"}'>
                                Backup
                            </button>
                        </li>
                    `
                      )
                      .join("")}
                </ul>
            `
        }
    </div>
`;


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
    return true;
  } catch (error) {
    console.error(`Failed to backup ${packageName}:`, error);
    return false;
  }
}
