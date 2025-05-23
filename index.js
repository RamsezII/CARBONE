// Base URL for fetch requests
const baseUrl = "https://shitstorm.ovh/";

// Config
let hostname = "3VE";
let cwd = "/";
let history = [];
let historyIndex = 0;

const terminal = document.getElementById('terminal');

let autocompleteContainer = null;

function printPrompt() {
    const div = document.createElement('div');
    div.className = 'input-line';

    // Prompt
    const promptSpan = document.createElement('span');
    promptSpan.className = 'prompt';
    promptSpan.textContent = hostname;
    div.appendChild(promptSpan);

    // :
    const colonSpan = document.createElement('span');
    colonSpan.textContent = ':';
    div.appendChild(colonSpan);

    // CWD
    const cwdLink = document.createElement('a');
    cwdLink.href = baseUrl.replace(/\/+$/, '') + "/" + cwd.replace(/^\/+/, '');
    let content = baseUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    content += '/' + cwd.replace(/^\/+/, '');
    cwdLink.textContent = content;
    cwdLink.className = 'cwd';
    cwdLink.target = '_blank';
    cwdLink.rel = 'noopener noreferrer';
    div.appendChild(cwdLink);

    // $
    const dollarSpan = document.createElement('span');
    dollarSpan.className = 'dollar';
    dollarSpan.textContent = ' $ ';
    div.appendChild(dollarSpan);

    // Input
    const input = document.createElement('input');
    input.type = 'text';
    input.autofocus = true;
    input.spellcheck = false;
    input.className = 'terminal-input';
    div.appendChild(input);

    terminal.appendChild(div);
    input.focus();

    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            const cmd = input.value;
            history.push(cmd);
            historyIndex = history.length;
            // Figer la ligne de saisie
            const typed = document.createElement('span');
            typed.className = 'typed-cmd';
            typed.textContent = input.value;
            div.replaceChild(typed, input);
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
        // Tab for autocomplete
        else if (e.key === 'Tab') {
            e.preventDefault();
            await handleAutocomplete(input);
        }
    });
}

// Autocomplete logic (moved outside printPrompt)
async function handleAutocomplete(input) {
    const currentValue = input.value;
    const cursorPos = input.selectionStart;

    // Split input into command and args
    const beforeCursor = currentValue.slice(0, cursorPos);
    const tokens = beforeCursor.trim().split(/\s+/);
    const command = tokens[0] || '';
    const arg = tokens.length > 1 ? tokens[tokens.length - 1] : '';

    let options = [];
    if (tokens.length === 1) {
        // Autocomplete command names
        const commands = ['ls', 'cd', 'cat', 'help', '?'];
        options = commands.filter(c => c.startsWith(command));
    } else {
        // Autocomplete file or directory names in current directory
        let base = cwd;
        let files = await fetchDir(base);
        if (!files) files = [];
        options = files.filter(f => f.startsWith(arg));
    }

    if (options.length === 0) {
        clearAutocomplete();
        return;
    } else if (options.length === 1) {
        // Single match, autocomplete inline
        const completion = options[0];
        const newValue = beforeCursor.slice(0, beforeCursor.length - arg.length) + completion + ' ';
        input.value = newValue + currentValue.slice(cursorPos);
        input.setSelectionRange(newValue.length, newValue.length);
        clearAutocomplete();
    } else {
        // Multiple matches, show dropdown
        showAutocompleteDropdown(input, options);
    }
}

function clearAutocomplete() {
    if (autocompleteContainer) {
        autocompleteContainer.remove();
        autocompleteContainer = null;
    }
}

function showAutocompleteDropdown(input, options) {
    clearAutocomplete();
    autocompleteContainer = document.createElement('div');
    Object.assign(autocompleteContainer.style, {
        position: 'absolute',
        background: '#181a1b',
        border: '1px solid #8ae234',
        color: '#eee',
        fontFamily: 'monospace',
        fontSize: '14px',
        maxHeight: '150px',
        overflowY: 'auto',
        zIndex: '1000'
    });

    // Position below input (relative to viewport)
    const rect = input.getBoundingClientRect();
    autocompleteContainer.style.left = rect.left + window.scrollX + 'px';
    autocompleteContainer.style.top = rect.bottom + window.scrollY + 'px';
    autocompleteContainer.style.minWidth = rect.width + 'px';

    options.forEach(option => {
        const optionDiv = document.createElement('div');
        optionDiv.textContent = option;
        optionDiv.style.padding = '2px 5px';
        optionDiv.style.cursor = 'pointer';
        optionDiv.addEventListener('mousedown', (e) => {
            e.preventDefault();
            selectAutocompleteOption(input, option);
        });
        autocompleteContainer.appendChild(optionDiv);
    });

    document.body.appendChild(autocompleteContainer);
}

function selectAutocompleteOption(input, option) {
    const currentValue = input.value;
    const cursorPos = input.selectionStart;
    const beforeCursor = currentValue.slice(0, cursorPos);
    const tokens = beforeCursor.trim().split(/\s+/);
    const arg = tokens.length > 1 ? tokens[tokens.length - 1] : '';

    const newValue = beforeCursor.slice(0, beforeCursor.length - arg.length) + option + ' ';
    input.value = newValue + currentValue.slice(cursorPos);
    input.setSelectionRange(newValue.length, newValue.length);
    clearAutocomplete();
}

// Helper: fetch directory (assume nginx autoindex returns JSON or HTML)
async function fetchDir(path) {
    const fullPath = baseUrl + path.replace(/^\/+/, '');
    // Fetch directory JSON directly from the directory path (nginx autoindex returns JSON)
    try {
        let res = await fetch(fullPath);
        if (res.ok) {
            let json = await res.json();
            // Adapte selon ta structure (ici, tableau d'objets avec {name, type, mtime, size})
            // On retourne un tableau de noms de fichiers uniquement
            return json.map(item => item.name);
        }
    } catch (e) {
        console.error("fetchDir error:", e);
    }
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

    // Normalise le chemin pour éviter les doubles slashs
    let displayCwd = cwd.replace(/\/+/g, '/');
    if (displayCwd !== '/' && displayCwd.endsWith('/'))
        displayCwd = displayCwd.slice(0, -1);
    if (!displayCwd.startsWith('/'))
        displayCwd = '/' + displayCwd;

    let args = cmd.trim().split(/\s+/);
    let command = args[0];
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
        output.textContent = (!files || files.length === 0)
            ? "ls: cannot access: permission denied or not found or empty directory"
            : files.join('\n');
    } else if (command === 'cd') {
        let target = args[1];
        if (!target) {
            cwd = "/";
        } else {
            let newPath = base + target;
            if (!newPath.endsWith('/')) newPath += '/';
            newPath = sanitizePath(newPath);
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
            output.textContent = (content === null)
                ? `cat: ${file}: No such file`
                : content;
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
// Ne pas afficher le prompt deux fois au démarrage
if (!terminal.querySelector('input')) {
    printPrompt();
}
terminal.addEventListener('click', () => {
    const lastInput = terminal.querySelector('input.terminal-input:last-of-type');
    if (lastInput)
        lastInput.focus();
});
