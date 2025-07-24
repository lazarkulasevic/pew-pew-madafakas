# WebAssembly Space Shooter Game

A high-performance space shooter game built with WebAssembly (Rust) and TypeScript. This project demonstrates the power of WebAssembly for real-time game development with smooth 60fps gameplay.

## Features

- **High-Performance Game Engine**: All game logic runs in WebAssembly for optimal performance
- **Real-time Controls**: Smooth arrow key movement and shooting mechanics
- **Progressive Difficulty**: Enemies spawn faster and become more challenging as you level up
- **Power-up System**: Collect upgrades to enhance your ship's capabilities
- **Multiple Enemy Types**: Different enemies with unique behaviors and health
- **Collision Detection**: Precise hit detection between all game objects
- **Responsive Design**: Automatically adapts to window resizing

## Game Mechanics

### Controls

- **↑↓←→ Arrow Keys** or **WASD** = Move spaceship
- **SPACEBAR** = Shoot at enemies
- **Dodge enemies** and **collect power-ups**!

### Enemy Types

- **🔴 Red Circles** = Basic enemies (easy to destroy)
- **🟠 Orange Triangles** = Fast enemies (move quickly)
- **🟣 Purple Squares** = Tank enemies (high health, health bars)

### Power-up System

- **♥ Green Hearts** = Health boost
- **⚡ Yellow Lightning** = Weapon upgrade (more bullets)
- **🛡 Blue Shields** = Shield boost

### Weapon Levels

- **Level 1**: Single bullet
- **Level 2**: Double bullets
- **Level 3**: Triple spread shot

## Technology Stack

- **Rust + WebAssembly**: Core game engine with wasm-bindgen
- **TypeScript**: Application logic and Canvas rendering
- **Vite**: Build tool and development server
- **Canvas API**: 2D graphics rendering

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [Rust](https://rustup.rs/) (for WebAssembly compilation)
- [wasm-pack](https://rustwasm.github.io/wasm-pack/) (install with `cargo install wasm-pack`)

## Setup Instructions

1. **Install Dependencies**:

   ```bash
   npm install
   ```

2. **Install Rust and wasm-pack** (if not already installed):

   ```bash
   # Install Rust
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

   # Install wasm-pack
   cargo install wasm-pack
   ```

3. **Build WebAssembly Module**:

   ```bash
   npm run build:wasm
   ```

4. **Start Development Server**:

   ```bash
   npm run dev
   ```

5. **Open Browser**:
   Navigate to `http://localhost:5173` to play the game!

## Performance

The WebAssembly implementation provides significant performance improvements for:

- Physics calculations
- Collision detection
- Game state management
- Memory management
- Real-time updates

## Project Structure

```
the-game/
├── wasm/                 # Rust WebAssembly module
│   ├── src/
│   │   └── lib.rs       # Game engine implementation
│   └── Cargo.toml       # Rust dependencies
├── src/
│   ├── game.ts          # TypeScript game renderer
│   └── wasm/            # Compiled WebAssembly files
├── index.html           # Main HTML file
├── package.json         # Node.js dependencies
├── vite.config.ts       # Vite configuration
└── tsconfig.json        # TypeScript configuration
```

## Building for Production

```bash
npm run build
```

This will create an optimized production build in the `dist/` directory.

## Game Features

### Core Gameplay

- **Player Ship**: Blue spaceship with engine glow effects
- **Enemy Spawning**: Progressive difficulty with different enemy types
- **Bullet System**: Both player and enemy bullets with collision detection
- **Power-ups**: Collectible items that enhance your ship
- **Health System**: Manage your ship's health to survive longer
- **Scoring**: Points for destroying enemies, with bonus points for tank enemies

### Visual Effects

- **Animated Starfield**: Dynamic background with moving stars
- **Ship Design**: Detailed spaceship with multiple color layers
- **Enemy Variety**: Different shapes and colors for each enemy type
- **Bullet Trails**: Visual effects for player bullets
- **Power-up Glow**: Glowing effects for collectible items

## Customization

You can easily modify the game by:

1. **Adding new enemies**: Edit `wasm/src/lib.rs` to add new enemy types
2. **Changing visuals**: Modify the rendering code in `src/game.ts`
3. **Adding new power-ups**: Implement new collectible items
4. **Sound effects**: Add audio feedback for actions
5. **Particle effects**: Add explosion and impact effects

## Browser Compatibility

This project requires modern browsers with WebAssembly support:

- Chrome 57+
- Firefox 52+
- Safari 11+
- Edge 16+

## License

MIT License - feel free to use this project for learning and experimentation!

## Future Enhancements

- Sound effects and background music
- Boss battles
- Multiple weapon types
- Particle explosion effects
- High score persistence
- Mobile touch controls
- Multiplayer support
