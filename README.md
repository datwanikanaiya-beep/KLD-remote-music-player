# Remote Music Player 🎵

A sleek, highly optimized web application that allows you to play remote audio files securely across two devices using a fully peer-to-peer WebRTC connection.

## Key Features
- **High-Speed WebRTC Chunking**: Beams local 10MB+ audio files instantly via a custom chunk-and-ACK WebRTC DataChannel, bypassing network freezes and `SCTP` buffer bloat.
- **Glassmorphism UI**: Stunning dark mode, fluid gradients, and modern interactions.
- **Perfect Synchronization**: Mobile-friendly playback UI with synchronized play, pause, progress tracking, and volume controls.
- **Cross-Platform**: Works securely on iOS Safari, Android, Windows, and macOS architectures.

---

## 🚀 Step-by-Step Installation Guide

If you want to move this project and install it on a brand new system, follow these instructions. 

### 1. System Prerequisites
You must have **Node.js** installed on the new system to execute the application code. 
- Download and install Node.js from [nodejs.org](https://nodejs.org/).

### 2. Copy the Source Files
Transfer this entire project folder to your new system. 
> *Tip: You do not need to copy the `node_modules` folder! It is hundreds of megabytes large and will be flawlessly regenerated natively on the new computer.*

### 3. Install Required Dependencies
Open your terminal or command prompt, navigate into the project directory, and run:
```bash
npm install
```
This automatically parses the `package.json` file and pulls down all exact dependencies required to run the player:
- `vite` & `react` (For blazing fast UI rendering)
- `peerjs` (For handling the direct P2P connections)
- `lucide-react` (For rendering the high-quality SVG interface icons)

### 4. Start the Application Manager
Once the installation successfully finishes, boot up the local hosting server by running:
```bash
npm run dev -- --host
```
*(The `--host` flag ensures your application is visible to other smartphones/laptops on your local WiFi network, rather than strictly remaining locked to `localhost`.)*

### 5. Start Controlling!
Vite will supply you with URLs in the terminal output once it is done building (e.g., `http://192.168.1.x:5173`).

- **Device A (Receiver, connected to speakers)**: Open the URL in the browser, select **Receiver**, and note down the short 4-character **Pairing Code**.
- **Device B (Controller, where your MP3 files are)**: Open the same URL on your smartphone or another computer, select **Controller**, enter the Pairing Code, and start adding your music!
