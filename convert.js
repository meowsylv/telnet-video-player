const fs = require("fs");
const path = require("path");
const child_process = require("child_process");
const { createCanvas, loadImage } = require("canvas");
let [ width, height ] = process.argv[process.argv.length - 2].split("x");
let framerate = parseInt(process.argv[process.argv.length - 1]);
width = parseInt(width);
height = parseInt(height);

console.log(`telnet-video-player video conversion tool`);

async function convert(videoPath, width, height) {
    let output = [];
    writeInt(output, width);
    writeInt(output, height);
    writeInt(output, framerate);
    let frames;
    console.log("Creating temporary directory...");
    let tmpDir = fs.mkdtempSync("telnet-video-player-");
    console.log("Extracting frames...");
    child_process.execSync(`ffmpeg -i "${escape(videoPath)}" -vf fps=${framerate} "${path.join(tmpDir, "%d.png")}"`);
    let frameCount = fs.readdirSync(tmpDir).length;
    console.log("Initializing canvas...");
    let canvas = createCanvas(width, height);
    let ctx = canvas.getContext("2d");
    let lastFrame;
    
    for(let i = 0; i < frameCount; i++) {
        process.stdout.write(`Processing frame #${i + 1}... `);
        let frame = await loadImage(path.join(tmpDir, `${i + 1}.png`));
        ctx.clearRect(0, 0, width, height);
        ctx.drawImage(frame, 0, 0, width, height);
        let imageData = ctx.getImageData(0, 0, width, height);
        let raw = [];
        let frameData = [];
        for(let j = 0; j < width * height; j++) {
            raw.push(toGrayscale(...imageData.data.slice(j * 4, j * 4 + 3)));
        }
        if(i === 0) {
            //console.log(raw);
            addPixels(frameData, 0, raw);
        }
        else {
            let diff = false;
            let startPos;
            for(let j = 0; j < width * height; j++) {
                if(lastFrame[j] !== raw[j]) {
                    if(!diff) {
                        startPos = j;
                        diff = true;
                    }
                }
                else {
                    if(diff) {
                        addPixels(frameData, startPos, raw.slice(startPos, j));
                        diff = false;
                    }
                }
            }
            if(diff) {
                addPixels(frameData, startPos, raw.slice(startPos, width * height));
            }
        }
        console.log("done.");
        //console.log(frameData);
        lastFrame = raw;
        addFrame(output, frameData);
    }
    fs.writeFileSync("video.dat", Buffer.from(output));
}

function addFrame(arr, frame) {
    writeInt(arr, frame.length);
    for(let f of frame) {
        arr.push(f);
    }
}

function addPixels(arr, pos, pixels) {
    writeInt(arr, pos);
    writeInt(arr, pixels.length);
    for(let p of pixels) {
        arr.push(p);
    }
}

function writeInt(arr, num) {
    let n = Math.floor(num);
    for(let i = 0; i < 32 / 8; i++) {
        arr.push((n >> (i * 8)) & 0xff);
    }
}

function toGrayscale(r, g, b) {
    return Math.floor(0.299 * r + 0.587 * g + 0.114 * b);
}

function escape(data) {
    return data.replace(/(["\s'$`\\])/g,'\\$1');
}

convert(process.argv[process.argv.length - 3], width, height);
