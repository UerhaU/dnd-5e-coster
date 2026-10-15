import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Check Git's actual file selection, including already tracked ignored files.
// Before git init, use a temporary index outside the project without staging it.
const root = process.cwd();
let temporaryGitDirectory;
let gitOptions = [];

function git(args) {
  return execFileSync('git', [...gitOptions, ...args], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function isPrivateFile(file) {
  if (file === '.env.example' || file === 'storage/.gitkeep' || file === 'База заклинаний.accdb') return false;
  return /(^|\/)(book|books|node_modules|dist|\.vite|\.codex-logs|\.idea|\.vscode)(\/|$)/i.test(file)
    || /^storage\//i.test(file)
    || /^database\/(equipment|spells\/(backups|work))\//i.test(file)
    || /(^|\/)\.env(?:\.|$)/i.test(file)
    || /\.local(?:\.|$)/i.test(file)
    || /\.(pdf|epub|djvu|mobi|msi|exe|zip|7z|rar|pem|key|p12|pfx|log|tsbuildinfo|tmp|bak|backup|accdb|laccdb|mdb|ldb|building|pyc)$/i.test(file)
    || /(^|\/)__pycache__\//i.test(file)
    || /\.(db|sqlite|sqlite3)(?:-.*)?$/i.test(file)
    || /(^|\/)(query|\.DS_Store|Thumbs\.db|Desktop\.ini)$/i.test(file);
}

try {
  try {
    const repositoryRoot = git(['rev-parse', '--show-toplevel']).trim();
    if (path.resolve(repositoryRoot).toLowerCase() !== path.resolve(root).toLowerCase()) {
      throw new Error('Run this check from the project repository root.');
    }
  } catch (error) {
    // A real parent repository must not be silently replaced with a preview.
    if (!String(error.stderr ?? '').includes('not a git repository')) throw error;
    temporaryGitDirectory = mkdtempSync(path.join(tmpdir(), 'dnd-publication-'));
    git(['init', '--bare', '--quiet', temporaryGitDirectory]);
    gitOptions = [`--git-dir=${temporaryGitDirectory}`, `--work-tree=${root}`, '-c', 'core.bare=false'];
    console.log('No repository yet: previewing files using the current .gitignore.');
  }

  const files = [...new Set(git(['ls-files', '--cached', '--others', '--exclude-standard', '-z'])
    .split('\0').filter(Boolean))].sort();
  const blocked = files.filter(isPrivateFile);

  if (blocked.length) {
    console.error('Publication blocked: local/private or generated files are selected by Git:');
    for (const file of blocked) console.error(`  ${file}`);
    console.error('If already tracked, remove them from the index; .gitignore alone is insufficient.');
    process.exitCode = 1;
  } else {
    console.log(`PASS: ${files.length} files selected; no forbidden paths or file types found.`);
    console.log('This checks file selection, not all possible secrets or content rights. Review the diff before committing.');
  }

  if (process.argv.includes('--list')) {
    for (const file of files) console.log(file);
  }
} finally {
  if (temporaryGitDirectory) {
    const target = path.resolve(temporaryGitDirectory);
    if (path.dirname(target).toLowerCase() !== path.resolve(tmpdir()).toLowerCase()
      || !path.basename(target).startsWith('dnd-publication-')) {
      throw new Error('Refusing to clean a directory outside the temporary publication workspace.');
    }
    rmSync(target, { recursive: true, force: true });
  }
}
