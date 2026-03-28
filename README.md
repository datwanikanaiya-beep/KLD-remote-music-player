# Remote Music Player 🎵

A premium, high-speed remote music dashboard that allows you to stream local audio securely across two devices using a fully peer-to-peer WebRTC connection.

## Key Features
- **Dark Dashboard Aesthetic**: Stunning deep-matte interface with vibrant neon purple accents and dedicated widget cards.
- **Live Frequency Visualizer**: Taps into the Web Audio API to display live, dancing neon bars responding directly to the frequencies of the playing song.
- **High-Speed WebRTC Chunking**: Beams local 10MB+ audio files instantly via a custom chunk-and-ACK DataChannel, bypassing network freezes and SCTP buffer bloat.
- **SVG Progress Dial**: The Controller widget features a glowing circular path that dynamically ticks 360-degrees around the track icon to display playback percentage.
- **Remote Ecosystem**: Includes dedicated widgets for master Volume control, Shuffle randomization, and track Looping.
- **Cross-Platform**: Works securely on iOS Safari, Android, Windows, and macOS architectures.

---

## 🚀 Step-by-Step Installation Guide

*(Note: Depending on your system file permissions or firewall settings, you may need to run the compilation commands with `sudo` Administrator/root privileges as outlined below.)*

### 1. System Prerequisites
You must have **Node.js** installed on the new system to execute the application code. 
- Download and install Node.js from [nodejs.org](https://nodejs.org/).

### 2. Copy the Source Files
Transfer this entire project folder to your new system. 
> *Tip: You do not need to copy the `node_modules` folder! It is hundreds of megabytes large and will be flawlessly regenerated natively on the new computer.*

### 3. Install Required Dependencies
Open your terminal or command prompt, navigate into the project directory, and ensure you have root permissions by running:
```bash
sudo npm install
```
This automatically parses the `package.json` file and pulls down all exact dependencies required to run the player:
- `vite` & `react` (For blazing fast UI rendering)
- `peerjs` (For handling the direct P2P connections)
- `lucide-react` (For rendering the high-quality SVG interface icons)

### 4. Start the Application Manager
Once the installation successfully finishes, boot up the local hosting server by running:
```bash
sudo npm run dev -- --host
```
*(The `--host` flag ensures your application is visible to other smartphones/laptops on your local WiFi network, rather than strictly remaining locked to `localhost`.)*

### 5. Start Controlling!
Vite will supply you with URLs in the terminal output once it is done building (e.g., `http://192.168.1.x:5173`).

- **Device A (Receiver, connected to speakers)**: Open the URL in the browser, select **Receiver**, and note down the short 4-character **Pairing Code**.
- **Device B (Controller, where your MP3 files are)**: Open the same URL on your smartphone or another computer, select **Controller**, enter the Pairing Code, and start adding your music!
