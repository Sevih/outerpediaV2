// scripts/commit.mjs — Outerpedia V2 commit automation
import { execSync } from "node:child_process";
import fs from "node:fs";
import readline from "node:readline";

/* ==========================================================
   CLI FLAGS
   ========================================================== */
const args = new Set(process.argv.slice(2));
function argHas(flag) { return args.has(flag); }
function argValue(name) {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

const DRY_RUN    = argHas("--dry-run");
const SKIP_BUILD = argHas("--skip-build") || argHas("--no-build");
const NO_PUSH    = argHas("--no-push");
const DO_TAG     = argHas("--tag");
const FORCE_MSG  = argValue("--msg");

if (argHas("--help") || argHas("-h")) {
  console.log(`
\x1b[36m───────────────────────────────────────────────
  OUTERPEDIA V2 — Commit Script
───────────────────────────────────────────────\x1b[0m

\x1b[1mUSAGE:\x1b[0m
  node scripts/commit.mjs [options]

\x1b[1mOPTIONS:\x1b[0m
  \x1b[33m--dry-run\x1b[0m       Simulate without executing anything
  \x1b[33m--skip-build\x1b[0m    Skip the build step
  \x1b[33m--no-push\x1b[0m       Local commit only, no push
  \x1b[33m--tag\x1b[0m           Create a git tag vX.Y.Z
  \x1b[33m--msg "<msg>"\x1b[0m   Commit message (skips prompt)

\x1b[1mNPM SHORTCUTS:\x1b[0m
  npm run commit          Version bump + commit + push (no build)
  npm run commit:fast     Same + skip build (alias)
  npm run commit:dry      Dry run simulation

\x1b[1mEXAMPLES:\x1b[0m
  node scripts/commit.mjs --dry-run
  node scripts/commit.mjs --skip-build --msg "fix icons"
  node scripts/commit.mjs --tag --msg "release: v1.0.0"
  node scripts/commit.mjs --no-push --msg "wip"
`);
  process.exit(0);
}

/* ==========================================================
   UTILS
   ========================================================== */
function sh(cmd) {
  if (DRY_RUN) { console.log(`  \x1b[90m[dry-run] ${cmd}\x1b[0m`); return ""; }
  return execSync(cmd, { stdio: "inherit", encoding: "utf-8" });
}
function shOut(cmd) {
  return execSync(cmd, { encoding: "utf-8" }).trim();
}
function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(question, ans => (rl.close(), res(ans.trim()))));
}
async function choose(title, choices) {
  console.log(title);
  choices.forEach((c, i) => console.log(`  ${i + 1}) ${c}`));
  while (true) {
    const a = await ask("Choice: ");
    const n = Number(a);
    if (!Number.isNaN(n) && n >= 1 && n <= choices.length) return n - 1;
    console.log("  Invalid choice.");
  }
}

/* ==========================================================
   VERSION
   ========================================================== */
function readVersion() {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf-8"));
  const m = pkg.version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!m) throw new Error(`Invalid version in package.json: "${pkg.version}"`);
  return { major: +m[1], minor: +m[2], patch: +m[3], raw: pkg.version };
}

/* ==========================================================
   MAIN
   ========================================================== */
(async () => {
  try {
    if (DRY_RUN) console.log("\x1b[33m[DRY RUN MODE]\x1b[0m\n");

    // 1. Version bump
    const { major, minor, patch, raw } = readVersion();
    console.log(`Current version: \x1b[36m${raw}\x1b[0m`);

    const bumpIdx = await choose("Version bump:", ["patch (fix)", "minor (feature)", "major (breaking)"]);
    let M = major, m = minor, p = patch;
    if (bumpIdx === 0) p += 1;
    else if (bumpIdx === 1) { m += 1; p = 0; }
    else { M += 1; m = 0; p = 0; }
    const newVersion = `${M}.${m}.${p}`;
    console.log(`New version: \x1b[32m${newVersion}\x1b[0m\n`);

    // 2. Update package.json + inject SW version
    console.log("Syncing version...");
    sh(`node scripts/set-version.js ${newVersion}`);

    // 3. Build (optional)
    if (SKIP_BUILD) {
      console.log("\n\x1b[90m[skip-build] Build skipped.\x1b[0m");
    } else {
      console.log("\nBuilding...");
      sh("npm run build");
    }

    // 4. Branch check
    const branch = shOut("git rev-parse --abbrev-ref HEAD");
    if (branch !== "main") {
      console.log(`\n\x1b[33mWarning: on branch "${branch}" (not main)\x1b[0m`);
      if (!FORCE_MSG) {
        const cont = await ask("Continue? (y/N) ");
        if (!/^y$/i.test(cont)) { console.log("Aborted."); process.exit(0); }
      }
    }

    // 5. Check for changes
    const status = shOut("git status --porcelain");
    if (!status) {
      console.log("\nNo changes to commit.");
      process.exit(0);
    }

    // 6. Commit message
    let msg = FORCE_MSG ?? await ask("Commit message: ");

    // 7. Discord announce
    let announceDiscord;
    if (process.env.DISCORD_ANNOUNCE === "0") {
      announceDiscord = false;
    } else if (FORCE_MSG) {
      announceDiscord = true;
    } else {
      const ann = await ask("Announce on Discord? (Y/n) ");
      announceDiscord = ann === "" || /^y$/i.test(ann);
    }
    const finalMsg = announceDiscord ? msg : `${msg} [no-discord]`;

    // 8. Git add + commit
    console.log("\nCommitting...");
    sh("git add .");
    sh(`git commit -m "${finalMsg.replace(/"/g, '\\"')}"`);

    // 9. Tag (optional)
    if (DO_TAG) {
      console.log(`Tagging v${newVersion}...`);
      sh(`git tag v${newVersion}`);
    }

    // 10. Push
    if (!NO_PUSH) {
      console.log(`\nPushing to ${branch}...`);
      sh(`git push origin ${branch}`);
      if (DO_TAG) sh("git push --tags");
    } else {
      console.log("\n\x1b[90m[no-push] No push.\x1b[0m");
    }

    console.log(`\n\x1b[32mDone — v${newVersion}\x1b[0m`);
  } catch (err) {
    console.error(`\n\x1b[31mError: ${err?.message ?? err}\x1b[0m`);
    process.exit(1);
  }
})();
