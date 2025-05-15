const terminal = document.getElementById('terminal');
let input = document.querySelector('.input');

let baseURL = window.location.href;

let userIP = "visitor";
let working_dir = baseURL;
const hostname = "3VE";

function formatPrompt(ip) {
    return `<span class="user">${ip}@${hostname}</span>:<span class="workingdir">${working_dir}</span>$ `;
}

function addLine(text) {
    const newLine = document.createElement('div');
    newLine.className = 'line';
    newLine.innerHTML = formatPrompt(userIP) + text;
    terminal.appendChild(newLine);
}

function addPrompt() {
    const newLine = document.createElement('div');
    newLine.className = 'line';
    const inputSpan = document.createElement('span');
    inputSpan.className = 'input';
    inputSpan.contentEditable = true;
    newLine.innerHTML = formatPrompt(userIP);
    newLine.appendChild(inputSpan);
    terminal.appendChild(newLine);
    inputSpan.focus();
    input = inputSpan;
}

document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const command = input.innerText.trim();
        addLine(command); // Echo the command
        addPrompt();
    }
});

window.addEventListener('click', () => {
    if (input) input.focus();
});
window.addEventListener('focus', () => {
    if (input) input.focus();
});

// 🌍 Get IP from ipify
fetch('https://api.ipify.org?format=json')
    .then(res => res.json())
    .then(data => {
        userIP = data.ip;
        // Replace first prompt if already visible
        const oldInput = document.querySelector('.input');
        if (oldInput) {
            oldInput.parentElement.innerHTML = formatPrompt(userIP);
            oldInput.parentElement.appendChild(oldInput);
            oldInput.focus();
        }
    })
    .catch(() => {
        userIP = "visitor";
    });
