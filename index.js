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

    // Correction du double slash dans l'affichage du chemin
    let displayCwd = cwd.replace(/\/+/g, '/');
    if (displayCwd !== '/' && displayCwd.endsWith('/')) displayCwd = displayCwd.slice(0, -1);
    if (!displayCwd.startsWith('/')) displayCwd = '/' + displayCwd;

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
    cwdLink.href = baseUrl.replace(/\/+$/, '') + displayCwd.replace(/^\/+/, '');
    cwdLink.textContent = baseUrl.replace(/^https?:\/\//, '') + displayCwd;
    cwdLink.className = 'cwd';
    cwdLink.target = '_blank';
    cwdLink.rel = 'noopener noreferrer';
    div.appendChild(cwdLink);

    // $ (prompt symbol)
    const dollarSpan = document.createElement('span');
    dollarSpan.textContent = '$';
    dollarSpan.style.marginLeft = '0.25em';
    div.appendChild(dollarSpan);

    // Zone éditable
    const input = document.createElement('span');
    input.contentEditable = 'true';
    input.spellcheck = false;
    input.autofocus = true;
    Object.assign(input.style, {
        background: 'transparent',
        border: 'none',
        color: '#eee',
        fontFamily: 'monospace',
        fontSize: '1em',
        outline: 'none',
        flex: '1',
        caretColor: '#8ae234',
        lineHeight: '1.5em',
        minHeight: '1.5em',
        verticalAlign: 'baseline',
        display: 'inline-block',
        minWidth: '2ch',
        whiteSpace: 'pre',
        marginLeft: '0.5em', // espace après le $
        padding: 0
    });
    div.appendChild(input);

    terminal.appendChild(div);
    input.focus();

    // Gestion clavier adaptée à contenteditable
    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const cmd = input.textContent;
            history.push(cmd);
            historyIndex = history.length;
            // Figer la ligne de saisie : remplacer le span par du texte
            const parent = input.parentElement;
            const typed = document.createElement('span');
            typed.textContent = input.textContent;
            typed.style.marginLeft = input.style.marginLeft;
            parent.replaceChild(typed, input);
            await handleCommand(cmd);
            printPrompt();
            terminal.scrollTop = terminal.scrollHeight;
        }
        // Up/down for history
        else if (e.key === 'ArrowUp') {
            if (historyIndex > 0) {
                historyIndex--;
                input.textContent = history[historyIndex] || "";
            }
            e.preventDefault();
        } else if (e.key === 'ArrowDown') {
            if (historyIndex < history.length - 1) {
                historyIndex++;
                input.textContent = history[historyIndex] || "";
            } else {
                input.textContent = "";
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
    const currentValue = input.textContent;
    const cursorPos = window.getSelection().getRangeAt(0).startOffset;

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
        let base = cwd.endsWith('/') ? cwd : cwd + '/';
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
        input.textContent = newValue + currentValue.slice(cursorPos);
        const range = document.createRange();
        const sel = window.getSelection();
        range.setStart(input.childNodes[0], newValue.length);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
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
    const currentValue = input.textContent;
    const cursorPos = window.getSelection().getRangeAt(0).startOffset;
    const beforeCursor = currentValue.slice(0, cursorPos);
    const tokens = beforeCursor.trim().split(/\s+/);
    const arg = tokens.length > 1 ? tokens[tokens.length - 1] : '';

    const newValue = beforeCursor.slice(0, beforeCursor.length - arg.length) + option + ' ';
    input.textContent = newValue + currentValue.slice(cursorPos);
    const range = document.createRange();
    const sel = window.getSelection();
    range.setStart(input.childNodes[0], newValue.length);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
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
    if (displayCwd !== '/' && displayCwd.endsWith('/')) displayCwd = displayCwd.slice(0, -1);
    if (!displayCwd.startsWith('/')) displayCwd = '/' + displayCwd;

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
    const lastInput = terminal.querySelector('span[contenteditable="true"]:last-of-type');
    if (lastInput)
        lastInput.focus();
});
