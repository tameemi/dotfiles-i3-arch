#!/usr/bin/env node
"use strict";

// Two-way sync of config files between this dotfiles repo and $HOME.
// Usage: node sync.js [--pull] [-n] [-v] [--link] [--exclude PATH]
//                  [--add-new PATH...]

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

// repo/home paths are relative; type: copy | link; exclude: repo-relative
const RULES = [
  { repo: ".config", home: ".config", type: "copy", exclude: [".config/.tmux.conf"] },
  { repo: ".config/.tmux.conf", home: ".tmux.conf", type: "link" },
  { repo: ".zshrc", home: ".zshrc", type: "copy" },
  { repo: ".oh-my-zsh", home: ".oh-my-zsh", type: "copy" },
];

const SKIP_DIRS = new Set([".git", "node_modules", ".cache", ".Trash"]);
const SKIP_FILES = new Set([".DS_Store"]);

const HELP = `usage: node sync.js [options]

Options:
  --pull              sync $HOME -> repo instead of repo -> $HOME
  -n, --dry-run       show what would change, write nothing
  -v, --verbose       also list files that are already in sync
  --link              symlink files into $HOME instead of copying
  --exclude PATH      skip a mapped repo path (repeatable)
  --add-new [PATH..]  (pull only) import new files found in $HOME;
                      without PATH only stray files in repo-known dirs
  -h, --help          show this help
`;

function parseArgs(argv) {
  const opts = {
    pull: false,
    dryRun: false,
    verbose: false,
    link: false,
    addNew: false,
    addNewPaths: [],
    excludes: [],
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--pull") opts.pull = true;
    else if (a === "-n" || a === "--dry-run") opts.dryRun = true;
    else if (a === "-v" || a === "--verbose") opts.verbose = true;
    else if (a === "--link") opts.link = true;
    else if (a === "--add-new") {
      opts.addNew = true;
      while (argv[i + 1] && !argv[i + 1].startsWith("-")) {
        opts.addNewPaths.push(argv[++i]);
      }
    } else if (a === "--exclude") {
      if (!argv[i + 1]) fail("--exclude needs a value");
      opts.excludes.push(argv[++i]);
    } else if (a === "-h" || a === "--help") {
      console.log(HELP);
      process.exit(0);
    } else {
      fail(`unknown argument: ${a}`);
    }
  }
  if (opts.addNew && !opts.pull) {
    console.warn("warn: --add-new has no effect without --pull");
  }
  return opts;
}

function fail(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

async function walk(dir, skipDirs = SKIP_DIRS, skipFiles = SKIP_FILES) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let dirents;
    try {
      dirents = await fsp.readdir(cur, { withFileTypes: true });
    } catch (e) {
      console.warn(`warn: cannot read ${cur}: ${e.message}`);
      continue;
    }
    for (const d of dirents) {
      const full = path.join(cur, d.name);
      if (d.isDirectory()) {
        if (!skipDirs.has(d.name)) stack.push(full);
      } else if (d.isFile()) {
        if (!skipFiles.has(d.name)) out.push(full);
      }
    }
  }
  return out;
}

async function sha256(p) {
  const data = await fsp.readFile(p);
  return crypto.createHash("sha256").update(data).digest("hex");
}

// same | update | new (dest missing)
async function copyStatus(src, dest) {
  try {
    const [sh, dh] = await Promise.all([sha256(src), sha256(dest)]);
    return sh === dh ? "same" : "update";
  } catch (e) {
    if (e.code === "ENOENT") return "new";
    throw e;
  }
}

// same | replace | missing, for symlink dest -> target
async function linkStatus(dest, target) {
  try {
    const st = await fsp.lstat(dest);
    if (st.isSymbolicLink()) {
      const cur = await fsp.readlink(dest);
      if (path.resolve(path.dirname(dest), cur) === target) return "same";
    }
    return "replace";
  } catch (e) {
    if (e.code === "ENOENT") return "missing";
    throw e;
  }
}

async function exists(p) {
  try {
    await fsp.lstat(p);
    return true;
  } catch {
    return false;
  }
}

async function buildEntries(repoRoot, home, rules) {
  const entries = [];
  for (const rule of rules) {
    const srcBase = path.join(repoRoot, rule.repo);
    const homeBase = path.join(home, rule.home);
    let st;
    try {
      st = await fsp.stat(srcBase);
    } catch {
      console.warn(`warn: skipping ${rule.repo} (not found in repo)`);
      continue;
    }
    if (st.isDirectory()) {
      for (const f of await walk(srcBase)) {
        const repoRel = path.relative(repoRoot, f);
        if (
          (rule.exclude || []).some(
            (ex) => repoRel === ex || repoRel.startsWith(ex + path.sep),
          )
        )
          continue;
        const rel = path.relative(srcBase, f);
        entries.push({
          repoRel,
          homeRel: path.relative(home, path.join(homeBase, rel)),
          src: f,
          dest: path.join(homeBase, rel),
          type: rule.type,
        });
      }
    } else {
      entries.push({
        repoRel: rule.repo,
        homeRel: rule.home,
        src: srcBase,
        dest: homeBase,
        type: rule.type,
      });
    }
  }
  return entries.sort((a, b) => a.dest.localeCompare(b.dest));
}

// $HOME items the repo lacks; unknown top-level entries reported whole,
// files diffed only inside dirs that exist on both sides
async function discoverNewInHome(repoRoot, home, rules) {
  const out = [];
  for (const rule of rules) {
    const homeBase = path.join(home, rule.home);
    const repoBase = path.join(repoRoot, rule.repo);
    let hst, rst;
    try {
      hst = await fsp.stat(homeBase);
    } catch {
      continue;
    }
    if (!hst.isDirectory()) continue;
    try {
      rst = await fsp.stat(repoBase);
    } catch {
      rst = null;
    }
    const repoKids =
      rst && rst.isDirectory()
        ? new Set(await fsp.readdir(repoBase))
        : new Set();
    const homeKids = await fsp.readdir(homeBase).catch(() => []);
    for (const k of homeKids) {
      if (SKIP_DIRS.has(k) || SKIP_FILES.has(k)) continue;
      const hk = path.join(homeBase, k);
      const rk = path.join(repoBase, k);
      let hstK;
      try {
        hstK = await fsp.stat(hk);
      } catch {
        continue;
      }
      if (!repoKids.has(k)) {
        out.push({
          homeAbs: hk,
          repoAbs: rk,
          repoRel: path.relative(repoRoot, rk),
          topLevel: true,
          dir: hstK.isDirectory(),
        });
        continue;
      }
      let rstK;
      try {
        rstK = await fsp.stat(rk);
      } catch {
        rstK = null;
      }
      if (rstK && hstK.isDirectory() && rstK.isDirectory()) {
        const hf = await walk(hk);
        const rf = new Set((await walk(rk)).map((f) => path.relative(rk, f)));
        for (const f of hf) {
          const rel = path.relative(hk, f);
          if (!rf.has(rel)) {
            out.push({
              homeAbs: f,
              repoAbs: path.join(rk, rel),
              repoRel: path.relative(repoRoot, path.join(rk, rel)),
              topLevel: false,
              dir: false,
            });
          }
        }
      }
    }
  }
  return out;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const repoRoot = path.dirname(fs.realpathSync(__filename));
  const home = os.homedir();
  const dir = opts.pull ? " <- " : " -> ";
  const label = opts.pull
    ? `${home}${dir}${repoRoot}`
    : `${repoRoot}${dir}${home}`;

  const rules = RULES.filter(
    (r) =>
      !opts.excludes.some(
        (e) => r.repo === e || r.repo.startsWith(e + path.sep),
      ),
  );
  if (rules.length === 0) fail("no sync rules left after --exclude");

  const entries = await buildEntries(repoRoot, home, rules);
  const newInHome = await discoverNewInHome(repoRoot, home, rules);

  const counts = {
    new: 0,
    update: 0,
    link: 0,
    same: 0,
    notInRepo: 0,
    missing: 0,
  };
  const plan = [];

  for (const e of entries) {
    const src = opts.pull ? e.dest : e.src;
    const dest = opts.pull ? e.src : e.dest;

    if (opts.pull) {
      if (!(await exists(src))) {
        counts.missing++;
        if (opts.verbose) console.log(`  missing in $HOME  ${e.homeRel}`);
        continue;
      }
      const st = await fsp.lstat(src);
      if (st.isSymbolicLink()) {
        const cur = await fsp.readlink(src);
        if (path.resolve(path.dirname(src), cur) === dest) {
          counts.same++;
          if (opts.verbose) console.log(`  same              ${e.homeRel}`);
          continue;
        }
      }
      const s = await copyStatus(src, dest);
      if (s === "same") {
        counts.same++;
        if (opts.verbose) console.log(`  same              ${e.homeRel}`);
      } else if (s === "update") {
        counts.update++;
        plan.push({ kind: "copy", src, dest });
        console.log(`  update            ${e.homeRel}`);
      } else {
        counts.notInRepo++;
        if (opts.addNew) {
          counts.new++;
          plan.push({ kind: "copy", src, dest });
          console.log(`  new (in repo)     ${e.homeRel}`);
        }
      }
    } else {
      const isLink = e.type === "link" || opts.link;
      if (isLink) {
        const s = await linkStatus(dest, e.src);
        if (s === "same") {
          counts.same++;
          if (opts.verbose) console.log(`  linked            ${e.homeRel}`);
        } else {
          counts.link++;
          plan.push({ kind: "link", dest, target: e.src });
          console.log(`  link              ${e.homeRel} -> ${e.src}`);
        }
      } else {
        const s = await copyStatus(e.src, dest);
        if (s === "same") {
          counts.same++;
          if (opts.verbose) console.log(`  same              ${e.homeRel}`);
        } else if (s === "update") {
          counts.update++;
          plan.push({ kind: "copy", src: e.src, dest });
          console.log(`  update            ${e.homeRel}`);
        } else {
          counts.new++;
          plan.push({ kind: "copy", src: e.src, dest });
          console.log(`  new               ${e.homeRel}`);
        }
      }
    }
  }

  for (const it of newInHome) {
    let importIt = false;
    if (opts.pull && opts.addNew) {
      if (opts.addNewPaths.length === 0) {
        importIt = !it.topLevel;
      } else {
        importIt = opts.addNewPaths.some(
          (p) => it.repoRel === p || it.repoRel.startsWith(p + path.sep),
        );
      }
    }
    if (importIt) {
      const files = it.dir
        ? (await walk(it.homeAbs)).map((f) => ({
            src: f,
            repoRel: path.join(
              path.relative(repoRoot, it.repoAbs),
              path.relative(it.homeAbs, f),
            ),
          }))
        : [{ src: it.homeAbs, repoRel: path.relative(repoRoot, it.repoAbs) }];
      for (const f of files) {
        const dest = path.join(repoRoot, f.repoRel);
        counts.new++;
        plan.push({ kind: "copy", src: f.src, dest });
        console.log(`  new (in repo)     ${f.repoRel}`);
      }
    } else {
      counts.notInRepo++;
      if (opts.verbose) {
        console.log(`  not in repo       ${it.repoRel}${it.dir ? "/" : ""}`);
      }
    }
  }

  if (counts.notInRepo) {
    console.log(
      `  (${counts.notInRepo} items in $HOME are not in the repo — ` +
        `use --pull --add-new <path> to import)`,
    );
  }
  if (opts.pull && counts.missing) {
    console.log(
      `  (${counts.missing} repo files have no counterpart in $HOME)`,
    );
  }

  if (opts.dryRun) {
    console.log(
      `\n[dry-run] ${label} — ${plan.length} change(s) would be made`,
    );
    return;
  }
  for (const a of plan) {
    try {
      if (a.kind === "link") {
        await fsp.rm(a.dest, { recursive: true, force: true });
        await fsp.mkdir(path.dirname(a.dest), { recursive: true });
        await fsp.symlink(a.target, a.dest);
      } else {
        await fsp.mkdir(path.dirname(a.dest), { recursive: true });
        await fsp.copyFile(a.src, a.dest);
        const st = await fsp.stat(a.src);
        await fsp.chmod(a.dest, st.mode).catch(() => {});
      }
    } catch (e) {
      console.warn(`warn: failed ${a.kind} ${a.dest}: ${e.message}`);
    }
  }

  console.log(
    `\n${label}\n` +
      `  new: ${counts.new}  updated: ${counts.update}  linked: ${counts.link}  ` +
      `unchanged: ${counts.same}  not in repo: ${counts.notInRepo}  ` +
      `missing in $HOME: ${counts.missing}`,
  );
}

main().catch((e) => {
  console.error(`error: ${e.message}`);
  process.exit(1);
});
