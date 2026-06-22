Markdown
# Night Terrors 🔦

Night Terrors is a lightweight, cross-platform, multiplayer horror investigation game built with Node.js, Express, and Socket.io. Players can create custom lobby rooms, select maps, explore large environments with dynamic camera tracking, manage a 3-slot inventory system, and interact with equipment sync'd across all clients in real-time.

---

## 🚀 Features

* **Real-time Multiplayer:** Instantly create or join rooms using a unique 4-letter lobby code powered by WebSockets.
* **Large Maps & Dynamic Camera:** Explore expansive maps (like the Asylum or Woodland Cabin) with a camera system that seamlessly follows your player.
* **Inventory & Equipment System:** Vacuum up items (Flashlights, EMF Readers, Cameras) into a 3-slot HUD inventory, switch between slots, activate items, or drop them back onto the floor.
* **Cross-Platform Controls:** Play with a keyboard and mouse on PC, or use the dynamic touch-joystick and overlay buttons on mobile and tablet devices.

---

## 🛠️ Installation & Local Setup

To run this project locally on your machine, follow these steps:

1. **Clone the repository** or download the project files.
2. Ensure you have [Node.js](https://nodejs.org/) installed.
3. Open your terminal/PowerShell inside the project directory and install the dependencies:
   ```bash
   npm install express socket.io
Start the server:

Bash
node server.js
Open your web browser and navigate to:

Plaintext
http://localhost:3000
🎮 Game Controls
💻 PC / Desktop
Movement: W A S D or Arrow Keys

Inventory Slots: 1, 2, 3 keys

Use Active Item: Left-Click (Hold)

Drop Active Item: G key

📱 Mobile / Tablet
Movement: Touch and drag on the left side of the screen to use the dynamic virtual joystick.

Inventory Slots: Tap directly on any of the 3 item boxes at the bottom of the screen.

Use Active Item: Tap and hold the USE touch button on the right.

Drop Active Item: Tap the DROP touch button on the right.

🌐 Tech Stack
Frontend: HTML5 Canvas, CSS3, JavaScript (ES6)

Backend: Node.js, Express

Networking: Socket.io (WebSockets)
