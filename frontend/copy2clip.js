import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// 1. Define what to ignore (exact names or extensions)
const ignoreNames = ['node_modules', '.git', 'dist', 'build', '.env', 'package-lock.json', 'copy2clip.js'];
const ignoreExtensions = ['.log', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.mp4', '.pdf', '.zip'];

// 2. Helper function to check if a file/folder should be skipped
function shouldIgnore(itemPath) {
    const name = path.basename(itemPath);
    const ext = path.extname(name).toLowerCase();
    
    if (ignoreNames.includes(name)) return true;
    if (ignoreExtensions.includes(ext)) return true;
    
    // Ignore hidden files/folders (starting with dot) except specific ones if needed
    if (name.startsWith('.') && name !== '.env') return true; 
    
    return false;
}

// 3. Recursively get all valid files
function getFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const dirent of list) {
        const fullPath = path.join(dir, dirent.name);
        
        if (shouldIgnore(fullPath)) continue;
        
        if (dirent.isDirectory()) {
            results = results.concat(getFiles(fullPath));
        } else {
            results.push(fullPath);
        }
    }
    return results;
}

// 4. Execute the script
try {
    console.log('Scanning directory...');
    const rootDir = process.cwd();
    const files = getFiles(rootDir);

    if (files.length === 0) {
        console.log('No valid files found.');
        process.exit(0);
    }

    let clipboardContent = '';

    for (const file of files) {
        const relativePath = path.relative(rootDir, file);
        try {
            const content = fs.readFileSync(file, 'utf8');
            clipboardContent += `\n/* =========================================\n`;
            clipboardContent += `   File: ${relativePath.replace(/\\/g, '/')}\n`; 
            clipboardContent += `   ========================================= */\n\n`;
            clipboardContent += content + '\n';
        } catch (readErr) {
            console.log(`Skipping unreadable file: ${relativePath}`);
        }
    }

    // 5. Pipe output to Windows 'clip' command natively
    console.log('Writing to clipboard...');
    const clipProc = spawn('clip');
    clipProc.stdin.write(clipboardContent);
    clipProc.stdin.end();

    clipProc.on('close', (code) => {
        if (code === 0) {
            console.log(`✅ Successfully copied ${files.length} files to your clipboard!`);
        } else {
            console.error('❌ Failed to copy to clipboard.');
        }
    });

} catch (error) {
    console.error('❌ Error:', error.message);
}
