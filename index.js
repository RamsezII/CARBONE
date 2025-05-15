// Base URL for fetch requests
const baseUrl = "https://shitstorm.ovh/";

// Config
let hostname = "3VE";
let cwd = "/";
let history = [];
let historyIndex = 0;

const terminal = document.getElementById('terminal');

function printPrompt() {
    const div = document.createElement('div');
    div.className = 'input-line';
    div.innerHTML = `<span class="prompt">${hostname}</span>:<span class="cwd">${cwd}</span>$ <input autofocus />`;
    terminal.appendChild(div);
    const input = div.querySelector('input');
    input.focus();

    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            const cmd = input.value;
            history.push(cmd);
            historyIndex = history.length;
            div.innerHTML = `<span class="prompt">${hostname}</span>:<span class="cwd">${cwd}</span>$ ${cmd}`;
            await handleCommand(cmd);
            printPrompt();
            terminal.scrollTop = terminal.scrollHeight;
        }
        // Up/down for history
        else if (e.key === 'ArrowUp') {
            if (historyIndex > 0) {
                historyIndex--;
                input.value = history[historyIndex] || "";
            }
            e.preventDefault();
        } else if (e.key === 'ArrowDown') {
            if (historyIndex < history.length - 1) {
                historyIndex++;
                input.value = history[historyIndex] || "";
            } else {
                input.value = "";
                historyIndex = history.length;
            }
            e.preventDefault();
        }
    });

    // Add blinking cursor effect
    input.style.caretColor = '#8ae234';
}

// Helper: fetch directory (assume nginx autoindex returns JSON or HTML)
async function fetchDir(path) {
    const fullPath = baseUrl + path.replace(/^\/+/, '');
    // Fetch directory JSON directly from the directory path (nginx autoindex returns JSON)
    try {
        // Debug output
        const debugOutput = document.createElement('div');
        debugOutput.style.color = '#bbb'; // light gray
        debugOutput.style.fontStyle = 'italic';
        debugOutput.style.whiteSpace = 'pre-wrap';
        debugOutput.textContent = fullPath;
        terminal.appendChild(debugOutput);
        let res = await fetch(fullPath);
        if (res.ok) {
            let json = await res.json();
            // Adapte selon ta structure (ici, tableau d'objets avec {name, type, mtime, size})
            // On retourne un tableau de noms de fichiers uniquement
            return json.map(item => item.name);
        }
    } catch { }
    // fallback : parse HTML
    let res = await fetch(fullPath);
    let text = await res.text();
    let files = [];
    // Parse HTML (nginx autoindex) :
    let match;
    let regex = /<a href="([^"]+)">/g;
    while ((match = regex.exec(text)) !== null) {
        let name = match[1];
        // Ignore parent directory link
        if (name === '../') continue;
        files.push(name);
    }
    return files;
}

// Helper: fetch file
async function fetchFile(path) {
    const fullPath = baseUrl + path.replace(/^\/+/, '');
    let res = await fetch(fullPath);
    if (!res.ok) return null;
    return await res.text();
}

// Commandes
async function handleCommand(cmd) {
    const output = document.createElement('div');
    output.className = 'output';

    let args = cmd.trim().split(/\s+/);
    let command = args[0];

    // Emplacement courant
    let base = cwd.endsWith('/') ? cwd : cwd + '/';

    // Sanitize path to prevent directory traversal outside root
    function sanitizePath(path) {
        const parts = path.split('/').filter(p => p && p !== '.');
        const sanitized = [];
        for (const part of parts) {
            if (part === '..') {
                if (sanitized.length > 0) sanitized.pop();
            } else {
                sanitized.push(part);
            }
        }
        return '/' + sanitized.join('/') + (path.endsWith('/') ? '/' : '');
    }

    cwd = sanitizePath(cwd);

    if (command === 'ls') {
        let files = await fetchDir(base);
        if (!files || files.length === 0) {
            output.textContent = "ls: cannot access: permission denied or not found or empty directory";
        } else {
            output.textContent = files.join('\n');
        }
    } else if (command === 'cd') {
        let target = args[1];
        if (!target) {
            cwd = "/";
        } else {
            let newPath = base + target;
            if (!newPath.endsWith('/'))
                newPath += '/';
            newPath = sanitizePath(newPath);
            // Debug output
            // Remove this block to avoid double URL display on cd command
            /*
            const debugOutput = document.createElement('div');
            debugOutput.style.color = '#bbb'; // light gray
            debugOutput.style.fontStyle = 'italic';
            debugOutput.style.whiteSpace = 'pre-wrap';
            debugOutput.textContent = baseUrl + newPath.replace(/^\/+/, '');
            terminal.appendChild(debugOutput);
            */
            // Vérifie si le dossier existe
            let files = await fetchDir(newPath);
            if (!files) {
                output.textContent = `cd: ${target}: No such directory`;
            } else {
                cwd = newPath;
            }
        }
    } else if (command === 'cat') {
        let file = args[1];
        if (!file) {
            output.textContent = "cat: missing file operand";
        } else {
            let content = await fetchFile(base + file);
            if (content === null) {
                output.textContent = `cat: ${file}: No such file`;
            } else {
                output.textContent = content;
            }
        }
    } else if (command === 'help' || command === '?') {
        output.textContent = "Commands: ls, cd [dir], cat [file], help";
    } else if (command === '') {
        // ignore
    } else {
        output.textContent = `command not found: ${command}`;
    }
    terminal.appendChild(output);
    terminal.scrollTop = terminal.scrollHeight;
}

// Start terminal
printPrompt();
terminal.addEventListener('click', () => {
    const lastInput = terminal.querySelector('input:last-of-type');
    if (lastInput)
        lastInput.focus();
});
