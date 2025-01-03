const fs = require("fs");
const net = require("net");
const path = require("path");
const video = fs.readFileSync(path.join(__dirname, "video.dat"));
const introduction = fs.readFileSync(path.join(__dirname, "introduction.txt"));
let pos = 0;
let width = readInt();
let height = readInt();
let framerate = readInt();
let frameData = [];

function read() {
    return video.readUInt8(pos++);
}

function readInt() {
    pos += 4;
    return video.readUInt32LE(pos - 4);
}

process.stderr.write("Loading video... ");

while(pos < Buffer.byteLength(video)) {
    let frameLength = readInt();
    let frameEnd = pos + frameLength;
    let frame = [ ...(frameData.length === 0 ? [] : frameData[frameData.length - 1]) ];
    while(pos < frameEnd) {
        let p = readInt();
        let l = readInt();
        for(let i = 0; i < l; i++) {
            frame[p + i] = read();
        }
    }
    frameData.push(frame);
}

console.error("done.");

const server = net.createServer(socket => {
    let monochromeChars = " ▀▄█";
    let currentFrame = 0;
    let intervalId;
    let monochrome = false;
    let notif = "";
    let notifTimestamp = 0;
    let startTimeout;
    
    socket.on("error", end);
    socket.on("end", end);
    socket.write("\x1b[f\x1b[2J");
    socket.write(introduction);
    startTimeout = setTimeout(() => {
        toggleVideo();
        socket.on("data", data => {
            data.forEach(b => {
                let c = String.fromCodePoint(b).toLowerCase();
                switch(c) {
                    case "m" :
                        monochrome = !monochrome;
                        notification(`Monochrome mode ${monochrome ? "ON" : "OFF"}`);
                        break;
                    case "\n" :
                        toggleVideo();
                        notification(intervalId ? "Play" : "Pause");
                        interval(false);
                        break;
                }
            });
        });
    }, 5000);
    
    
    
    function toggleVideo() {
        if(intervalId) {
            clearTimeout(intervalId);
            intervalId = 0;
        }
        else {
            intervalId = setInterval(interval, 1000 / framerate);
        }
    }
    
    function interval(update = true) {
        let frame = frameData[currentFrame];
        socket.write("\x1b[f");
        for(let i = 0; i < height; i += 2) {
            let lb1;
            let lb2;
            for(let j = 0; j < width; j++) {
                let b1 = frame[i * width + j] || 0;
                let b2 = frame[(i + 1) * width + j] || 0;
                if(monochrome) {
                    let m1 = toMonochrome(b1);
                    let m2 = toMonochrome(b2);
                    let index = (m2 << 1) + m1;
                    socket.write(monochromeChars.charAt(index));
                }
                else {
                    socket.write(`${lb1 === b1 ? "" : `\x1b[48;2;${b1};${b1};${b1}m`}${lb2 === b2 ? "" : `\x1b[38;2;${b2};${b2};${b2}m`}▄`);
                    lb1 = b1;
                    lb2 = b2;
                }
            }
            socket.write("\x1b[0m\r\n");
        }
        if(Date.now() < (notifTimestamp + 3000)) {
            socket.write(`\x1b[f> ${notif}`);
        }
        if(update) {
            currentFrame++;
            if(currentFrame >= frameData.length) {
                clearInterval(intervalId);
                socket.end();
            }
        }
    }
    function notification(message) {
        notif = message;
        notifTimestamp = Date.now();
    }
    
    function end() {
        if(intervalId) clearInterval(intervalId);
        if(startTimeout) clearTimeout(startTimeout);
    }
});

function toMonochrome(c) {
    return Math.round(c / 256);
}

server.listen(23, () => console.error("Server started!"));
