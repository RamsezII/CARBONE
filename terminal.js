const terminal = document.getElementById('terminal');
let input = document.querySelector('.input');

function addLine(text) {
    const newLine = document.createElement('div');
    newLine.className = 'line';
    newLine.innerHTML = `paragon:~$ <span>${text}</span>`;
    terminal.appendChild(newLine);
}

function addPrompt() {
    const newLine = document.createElement('div');
    newLine.className = 'line';
    const inputSpan = document.createElement('span');
    inputSpan.className = 'input';
    inputSpan.contentEditable = true;
    newLine.innerHTML = 'paragon:~$ ';
    newLine.appendChild(inputSpan);
    terminal.appendChild(newLine);
    inputSpan.focus();
    input = inputSpan;
}

document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        const command = input.innerText.trim();
        addLine(command); // echo the command
        addPrompt();
    }
});
