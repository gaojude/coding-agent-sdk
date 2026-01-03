/**
 * Automated Release Workflow Example
 *
 * Zero-config automated release that:
 * 1. Runs pre-flight checks (branch, uncommitted changes, remote sync)
 * 2. Runs tests
 * 3. Builds the project
 * 4. Bumps version (patch/minor/major)
 * 5. Updates changelog
 * 6. Pushes to remote
 * 7. Creates GitHub release
 * 8. Publishes to npm (with 2FA/OTP support)
 *
 * Only uses LLM for tasks that need reasoning:
 * - Generating changelog summaries from git history
 * - Creating release notes
 * - Handling interactive npm publish with OTP
 *
 * Usage:
 *   node examples/release.mjs [patch|minor|major]
 *
 * Examples:
 *   node examples/release.mjs patch
 *   node examples/release.mjs minor
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { createClient, collectText } from "coding-agent-sdk";

function exec(command, options = {}) {
  try {
    const result = execSync(command, {
      encoding: "utf8",
      stdio: options.silent ? "pipe" : "inherit",
      ...options,
    });
    return result ? result.trim() : "";
  } catch (error) {
    if (options.allowFailure) {
      return "";
    }
    throw error;
  }
}

// Pre-flight checks - all procedural, no LLM needed
function preflightChecks() {
  console.log("Pre-flight checks...\n");

  // Check if on main branch
  const branch = exec("git branch --show-current", { silent: true });
  if (branch !== "main") {
    throw new Error(`Not on main branch (currently on: ${branch})`);
  }
  console.log("  On main branch");

  // Check for uncommitted changes
  const status = exec("git status --porcelain", { silent: true });
  if (status) {
    throw new Error(
      "Uncommitted changes detected. Commit or stash them first."
    );
  }
  console.log("  No uncommitted changes");

  // Check if up to date with remote
  exec("git fetch", { silent: true });
  const localHash = exec("git rev-parse HEAD", { silent: true });
  const remoteHash = exec("git rev-parse @{u}", {
    silent: true,
    allowFailure: true,
  });

  if (remoteHash && remoteHash !== localHash) {
    throw new Error(
      "Branch is not up to date with remote. Pull latest changes first."
    );
  }
  console.log("  Up to date with remote\n");
}

// Run tests - procedural
function runTests() {
  console.log("Running tests...\n");

  const pkg = JSON.parse(readFileSync("package.json", "utf8"));

  if (!pkg.scripts?.test) {
    console.log("  No test script found, skipping\n");
    return;
  }

  exec("npm test");
  console.log("\n  Tests passed\n");
}

// Build project - procedural
function buildProject() {
  console.log("Building project...\n");

  const pkg = JSON.parse(readFileSync("package.json", "utf8"));

  if (!pkg.scripts?.build) {
    console.log("  No build script found, skipping\n");
    return;
  }

  exec("npm run build");
  console.log("\n  Build successful\n");
}

// Bump version - procedural
function bumpVersion(type) {
  console.log(`Bumping ${type} version...\n`);

  const output = exec(`npm version ${type} --message "chore: release v%s"`, {
    silent: true,
  });
  const newVersion = output.replace(/^v/, "");

  console.log(`  Version bumped to ${newVersion}\n`);
  return newVersion;
}

// Update changelog - uses LLM to generate summary from git history
async function updateChangelog(version, client) {
  console.log("Updating CHANGELOG.md...\n");

  // Get commit history since last tag
  const lastTag = exec("git describe --tags --abbrev=0", {
    silent: true,
    allowFailure: true,
  });
  const range = lastTag ? `${lastTag}..HEAD` : "HEAD";
  const commits = exec(`git log ${range} --pretty=format:"%s" --no-merges`, {
    silent: true,
  });

  // Use LLM to summarize the commits into changelog format
  const session = await client.newSession();

  const changelogEntry = await collectText(
    session.prompt(
      `Generate a concise changelog entry for version ${version} based on these commits:

${commits}

Format as:
## [${version}] - ${new Date().toISOString().split("T")[0]}

[Group commits into categories like Added, Fixed, Changed if appropriate, or just list key changes]

Keep it brief and focused on user-facing changes. Output ONLY the changelog entry, no other text.`
    )
  );

  // Update or create CHANGELOG.md
  let changelog = "";
  if (existsSync("CHANGELOG.md")) {
    changelog = readFileSync("CHANGELOG.md", "utf8");
    // Insert new entry after the header
    const headerEnd = changelog.indexOf("\n\n") + 2;
    changelog =
      changelog.slice(0, headerEnd) +
      changelogEntry +
      "\n\n" +
      changelog.slice(headerEnd);
  } else {
    changelog = `# Changelog\n\n${changelogEntry}\n`;
  }

  writeFileSync("CHANGELOG.md", changelog);

  // Amend to version commit
  exec("git add CHANGELOG.md");
  exec("git commit --amend --no-edit");

  console.log("  Changelog updated\n");
}

// Push to remote - procedural
function pushToRemote() {
  console.log("Pushing to remote...\n");

  exec("git push");
  exec("git push --tags");

  console.log("  Pushed to remote\n");
}

// Create GitHub release - uses LLM to generate release notes from changelog
async function createGitHubRelease(version, client) {
  console.log("Creating GitHub release...\n");

  // Check if gh CLI is available
  const ghAvailable = exec("command -v gh", {
    silent: true,
    allowFailure: true,
  });

  if (!ghAvailable) {
    console.log("  GitHub CLI (gh) not found. Please create release manually:");
    console.log(`     gh release create v${version} --generate-notes\n`);
    return;
  }

  // Get changelog entry for this version
  const changelog = existsSync("CHANGELOG.md")
    ? readFileSync("CHANGELOG.md", "utf8")
    : "";
  const versionSection =
    changelog.match(
      new RegExp(`## \\[${version}\\][\\s\\S]*?(?=## \\[|$)`)
    )?.[0] || "";

  // Use LLM to format release notes
  const session = await client.newSession();

  const releaseNotes = await collectText(
    session.prompt(
      `Format this changelog entry as GitHub release notes:

${versionSection}

Make it concise and GitHub-flavored markdown friendly. Remove the version header since that's already in the release. Output ONLY the release notes, no other text.`
    )
  );

  // Create release
  writeFileSync("/tmp/release-notes.md", releaseNotes);
  exec(`gh release create v${version} --notes-file /tmp/release-notes.md`);

  console.log("  GitHub release created\n");
}

// Publish to npm - uses LLM to handle interactive OTP prompt
async function publishToNpm(client) {
  console.log("Publishing to npm...\n");
  console.log("  If 2FA is enabled, you'll be prompted for OTP\n");

  // Use LLM to run npm publish because it can handle interactive OTP prompts
  const session = await client.newSession();

  for await (const update of session.prompt(
    `Run 'npm publish' to publish this package to npm.

If prompted for an OTP (One-Time Password) due to 2FA, the prompt will appear and wait for user input. Just let it run - the user will provide their OTP when needed.`
  )) {
    if (
      update.sessionUpdate === "agent_message_chunk" &&
      update.content.type === "text"
    ) {
      process.stdout.write(update.content.text);
    } else if (update.sessionUpdate === "tool_call") {
      console.log(`\n[${update.title}]`);
    }
  }

  console.log("\n  Published to npm\n");
}

// Main workflow
async function release() {
  const releaseType = process.argv[2] || "patch";

  if (!["patch", "minor", "major"].includes(releaseType)) {
    console.error("Usage: node release.mjs [patch|minor|major]");
    process.exit(1);
  }

  console.log(`\nStarting ${releaseType} release...\n`);

  // Create client once and reuse for all LLM operations
  const client = createClient({
    autoApprove: true,
  });

  try {
    await client.connect();

    // Procedural checks and operations
    preflightChecks();
    runTests();
    buildProject();
    const version = bumpVersion(releaseType);

    // LLM-powered operations (need reasoning/generation)
    await updateChangelog(version, client);

    // Procedural push
    pushToRemote();

    // LLM-powered operations
    await createGitHubRelease(version, client);
    await publishToNpm(client);

    // Summary
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const pkgName = pkg.name;

    console.log("\nRelease completed successfully!\n");
    console.log(`${pkgName}@${version}`);
    console.log(`https://www.npmjs.com/package/${pkgName}/v/${version}`);
    console.log(
      `https://github.com/${pkg.repository?.url?.match(/github\.com[:/](.+?)(\.git)?$/)?.[1]}/releases/tag/v${version}\n`
    );
  } catch (error) {
    console.error("\nRelease failed:", error.message);
    console.error("\nPlease fix the issue and try again.");
    process.exit(1);
  } finally {
    await client.disconnect();
  }
}

release();
