import init, { GameEngine } from "./wasm/particle_system.js"
import { SoundManager } from "./sound.js"

class SpaceShooterGame {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private gameEngine: GameEngine | null = null
  private animationId: number | null = null
  private lastTime: number = 0
  private keys: Set<string> = new Set()
  private isShooting: boolean = false
  private isMovingForward: boolean = false
  private soundManager: SoundManager
  private lastExplosionCount: number = 0
  private lastBlackHoleCount: number = 0

  constructor() {
    this.canvas = document.getElementById("canvas") as HTMLCanvasElement
    this.ctx = this.canvas.getContext("2d")!
    this.soundManager = new SoundManager()
    this.setupCanvas()
    this.setupInput()
    this.init()
  }

  private setupCanvas(): void {
    const resize = () => {
      this.canvas.width = window.innerWidth
      this.canvas.height = window.innerHeight
      if (this.gameEngine) {
        // Note: We'll need to recreate the game engine on resize
        // For now, we'll just update the canvas size
      }
    }

    window.addEventListener("resize", resize)
    resize()
  }

  private setupInput(): void {
    // Keyboard input
    document.addEventListener("keydown", (e) => {
      this.keys.add(e.key.toLowerCase())
      if (e.key === " ") {
        e.preventDefault()
        this.isShooting = true
      }
      if (e.key === "q" || e.key === "Q") {
        e.preventDefault()
        this.activateBlackHole()
      }

      // Resume audio context on first user interaction
      this.soundManager.resumeAudio()
    })

    document.addEventListener("keyup", (e) => {
      this.keys.delete(e.key.toLowerCase())
      if (e.key === " ") {
        this.isShooting = false
      }
    })

    // Prevent context menu on right click
    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault()
    })
  }

  private async init(): Promise<void> {
    try {
      await init()
      this.gameEngine = GameEngine.new(this.canvas.width, this.canvas.height)
      this.startGameLoop()
    } catch (error) {
      console.error("Failed to initialize WebAssembly game:", error)
    }
  }

  private startGameLoop(): void {
    const gameLoop = (currentTime: number) => {
      this.animationId = requestAnimationFrame(gameLoop)

      const deltaTime = (currentTime - this.lastTime) / 1000
      this.lastTime = currentTime

      this.update(deltaTime)
      this.render()
    }

    this.lastTime = performance.now()
    gameLoop(this.lastTime)
  }

  private update(deltaTime: number): void {
    if (!this.gameEngine) return

    // Handle input - prevent multiple conflicting keys
    let dx = 0
    let dy = 0

    // Only allow one direction per axis (prioritize last pressed)
    const pressedKeys = Array.from(this.keys)

    // Handle horizontal movement - only one direction
    if (pressedKeys.includes("arrowleft") || pressedKeys.includes("a")) {
      dx = -1
    } else if (
      pressedKeys.includes("arrowright") ||
      pressedKeys.includes("d")
    ) {
      dx = 1
    }

    // Handle vertical movement - only one direction
    if (pressedKeys.includes("arrowup") || pressedKeys.includes("w")) {
      dy = -1
    } else if (pressedKeys.includes("arrowdown") || pressedKeys.includes("s")) {
      dy = 1
    }

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
      dx *= 0.707 // 1/√2
      dy *= 0.707
    }

    // Clamp values to prevent extreme movement
    dx = Math.max(-1, Math.min(1, dx))
    dy = Math.max(-1, Math.min(1, dy))

    // Store movement state for warp core effect
    this.isMovingForward = dy < 0

    this.gameEngine.move_player(dx, dy)

    if (this.isShooting) {
      this.gameEngine.shoot()
      this.soundManager.playLaserSound()
    }

    // Update game engine
    this.gameEngine.update(deltaTime)

    // Update UI
    this.updateUI()

    // Check game over
    if (this.gameEngine.is_game_over()) {
      this.showGameOver()
    }
  }

  private updateUI(): void {
    if (!this.gameEngine) return

    // Update score
    document.getElementById("score")!.textContent = this.gameEngine
      .get_score()
      .toString()

    // Update level
    document.getElementById("level")!.textContent = this.gameEngine
      .get_level()
      .toString()

    // Update health bar
    const healthPercent = (this.gameEngine.get_health() / 100.0) * 100
    const healthFill = document.getElementById("healthFill") as HTMLElement
    healthFill.style.width = `${healthPercent}%`

    // Update propulsion indicator
    const warpIndicator = document.getElementById(
      "warpIndicator"
    ) as HTMLElement
    if (warpIndicator) {
      if (this.isMovingForward) {
        warpIndicator.style.display = "block"
        warpIndicator.style.color = "#00ffff"
        warpIndicator.textContent = "PROPULSION ACTIVE"
      } else {
        warpIndicator.style.display = "none"
      }
    }

    // Update black hole indicator
    const blackHoleIndicator = document.getElementById(
      "blackHoleIndicator"
    ) as HTMLElement
    if (blackHoleIndicator) {
      const cooldown = this.gameEngine.get_black_hole_cooldown()
      if (cooldown > 0.0) {
        blackHoleIndicator.style.display = "block"
        blackHoleIndicator.style.color = "#ff00ff"
        blackHoleIndicator.textContent = `BLACK HOLE: ${cooldown.toFixed(1)}s`
      } else {
        blackHoleIndicator.style.display = "block"
        blackHoleIndicator.style.color = "#00ff00"
        blackHoleIndicator.textContent = "BLACK HOLE: READY"
      }
    }

    // Update shield bar
    const shieldLevel = this.gameEngine.get_shield_level()
    const shieldActive = this.gameEngine.is_shield_active()
    const shieldTimer = this.gameEngine.get_shield_timer()

    const shieldBar = document.getElementById("shieldBar") as HTMLElement
    const shieldFill = document.getElementById("shieldFill") as HTMLElement
    const shieldText = document.getElementById("shieldText") as HTMLElement

    if (shieldBar && shieldFill && shieldText) {
      if (shieldActive && shieldLevel > 0) {
        shieldBar.style.display = "block"
        const shieldPercent = (shieldLevel / 3.0) * 100
        shieldFill.style.width = `${shieldPercent}%`

        // Change color based on shield level
        if (shieldLevel === 1) {
          shieldFill.style.backgroundColor = "#00bcd4" // Cyan
        } else if (shieldLevel === 2) {
          shieldFill.style.backgroundColor = "#2196f3" // Blue
        } else {
          shieldFill.style.backgroundColor = "#9c27b0" // Purple
        }

        shieldText.textContent = `SHIELD: ${shieldLevel}/3 (${shieldTimer.toFixed(
          1
        )}s)`
      } else {
        shieldBar.style.display = "none"
      }
    }
  }

  private activateBlackHole(): void {
    if (this.gameEngine) {
      this.gameEngine.activate_black_hole()
      this.soundManager.playBlackHoleActivation()
    }
  }

  private render(): void {
    if (!this.gameEngine) return

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    // Draw starfield background
    this.drawStarfield()

    try {
      // Get game data from WebAssembly
      const gameData = this.gameEngine.get_game_data()
      let dataIndex = 0

      // Safety check for minimum data length
      if (gameData.length < 7) {
        console.error("Game data too short:", gameData.length)
        return
      }

      // Parse metadata: [player_count, enemy_count, player_bullet_count, enemy_bullet_count, power_up_count, explosion_count, black_hole_count]
      const playerCount = Math.floor(gameData[dataIndex++])
      const enemyCount = Math.floor(gameData[dataIndex++])
      const playerBulletCount = Math.floor(gameData[dataIndex++])
      const enemyBulletCount = Math.floor(gameData[dataIndex++])
      const powerUpCount = Math.floor(gameData[dataIndex++])
      const explosionCount = Math.floor(gameData[dataIndex++])
      const blackHoleCount = Math.floor(gameData[dataIndex++])

      // Check for new explosions and play sounds
      if (explosionCount > this.lastExplosionCount) {
        // New explosion detected - play tank explosion sound
        this.soundManager.playExplosionSound("tank")
      }
      this.lastExplosionCount = explosionCount

      // Check for new black holes and play sounds
      if (blackHoleCount > this.lastBlackHoleCount) {
        // New black hole detected - play black hole activation sound
        this.soundManager.playBlackHoleActivation()
      }
      this.lastBlackHoleCount = blackHoleCount

      // Safety check for reasonable counts
      if (
        enemyCount > 100 ||
        playerBulletCount > 100 ||
        enemyBulletCount > 100 ||
        powerUpCount > 50 ||
        explosionCount > 20
      ) {
        console.error("Unreasonable object counts:", {
          enemyCount,
          playerBulletCount,
          enemyBulletCount,
          powerUpCount,
          explosionCount,
        })
        return
      }

      // Draw player (6 values: x, y, size, health, power_level, growth_level)
      if (dataIndex + 5 < gameData.length) {
        const playerX = gameData[dataIndex++]
        const playerY = gameData[dataIndex++]
        const playerSize = gameData[dataIndex++]
        const playerHealth = gameData[dataIndex++]
        const playerPowerLevel = gameData[dataIndex++]
        const playerGrowthLevel = gameData[dataIndex++]

        // Safety check for player position
        if (playerX >= 0 && playerY >= 0 && playerSize > 0) {
          this.drawPlayer(
            playerX,
            playerY,
            playerSize,
            playerHealth,
            playerPowerLevel,
            playerGrowthLevel
          )
        }
      }

      // Draw enemies (5 values each: x, y, size, health, type)
      for (let i = 0; i < enemyCount && dataIndex + 4 < gameData.length; i++) {
        const x = gameData[dataIndex++]
        const y = gameData[dataIndex++]
        const size = gameData[dataIndex++]
        const health = gameData[dataIndex++]
        const enemyType = gameData[dataIndex++]

        // Safety check for enemy position
        if (x >= 0 && y >= 0 && size > 0) {
          this.drawEnemy(x, y, size, health, enemyType)
        }
      }

      // Draw player bullets (4 values each: x, y, size, is_enemy)
      for (
        let i = 0;
        i < playerBulletCount && dataIndex + 3 < gameData.length;
        i++
      ) {
        const x = gameData[dataIndex++]
        const y = gameData[dataIndex++]
        const size = gameData[dataIndex++]
        const isEnemy = gameData[dataIndex++]

        // Safety check for bullet position
        if (x >= 0 && y >= 0 && size > 0) {
          this.drawBullet(x, y, size, isEnemy === 1.0)
        }
      }

      // Draw enemy bullets (4 values each: x, y, size, is_enemy)
      for (
        let i = 0;
        i < enemyBulletCount && dataIndex + 3 < gameData.length;
        i++
      ) {
        const x = gameData[dataIndex++]
        const y = gameData[dataIndex++]
        const size = gameData[dataIndex++]
        const isEnemy = gameData[dataIndex++]

        // Safety check for bullet position
        if (x >= 0 && y >= 0 && size > 0) {
          this.drawBullet(x, y, size, isEnemy === 1.0)
        }
      }

      // Draw power-ups (4 values each: x, y, size, type)
      for (
        let i = 0;
        i < powerUpCount && dataIndex + 3 < gameData.length;
        i++
      ) {
        const x = gameData[dataIndex++]
        const y = gameData[dataIndex++]
        const size = gameData[dataIndex++]
        const powerType = gameData[dataIndex++]

        // Safety check for power-up position
        if (x >= 0 && y >= 0 && size > 0) {
          this.drawPowerUp(x, y, size, powerType)
        }
      }

      // Draw explosions (4 values each: x, y, size, life_ratio)
      for (
        let i = 0;
        i < explosionCount && dataIndex + 3 < gameData.length;
        i++
      ) {
        const x = gameData[dataIndex++]
        const y = gameData[dataIndex++]
        const size = gameData[dataIndex++]
        const lifeRatio = gameData[dataIndex++]

        // Safety check for explosion position
        if (x >= 0 && y >= 0 && size > 0) {
          this.drawExplosion(x, y, size, lifeRatio)
        }
      }

      // Draw black holes (5 values each: x, y, size, life_ratio, pull_radius)
      for (
        let i = 0;
        i < blackHoleCount && dataIndex + 4 < gameData.length;
        i++
      ) {
        const x = gameData[dataIndex++]
        const y = gameData[dataIndex++]
        const size = gameData[dataIndex++]
        const lifeRatio = gameData[dataIndex++]
        const pullRadius = gameData[dataIndex++]

        // Safety check for black hole position
        if (x >= 0 && y >= 0 && size > 0) {
          this.drawBlackHole(x, y, size, lifeRatio, pullRadius)
        }
      }

      // Read shield data using the GameEngine methods instead of parsing from array
      try {
        const shieldLevel = this.gameEngine.get_shield_level()
        const shieldActive = this.gameEngine.is_shield_active()
        const shieldTimer = this.gameEngine.get_shield_timer()

        // Draw shield if active
        if (shieldActive && shieldLevel > 0) {
          const time = Date.now() * 0.001
          // Get player position for shield rendering (player data starts at index 7)
          const playerX = gameData[7] // Player x position
          const playerY = gameData[8] // Player y position
          const playerSize = gameData[9] // Player size

          if (playerX >= 0 && playerY >= 0 && playerSize > 0) {
            this.drawEnergyShield(
              playerX,
              playerY,
              playerSize,
              shieldLevel,
              shieldTimer,
              time
            )

            // Draw shield level indicator
            this.ctx.fillStyle = "#00bcd4"
            this.ctx.font = "bold 12px Arial"
            this.ctx.textAlign = "center"
            this.ctx.fillText(
              `S${shieldLevel}`,
              playerX,
              playerY - playerSize - 45
            )
          }
        }
      } catch (error) {
        console.error("Error reading shield data:", error)
      }
    } catch (error) {
      console.error("Error in render function:", error)
    }
  }

  private drawStarfield(): void {
    const time = Date.now() * 0.001

    // Create elegant deep space background
    this.drawElegantSpaceBackground()

    // Draw realistic stars
    this.drawRealisticStars(time)

    // Draw subtle cosmic dust
    this.drawCosmicDust(time)
  }

  private drawElegantSpaceBackground(): void {
    // Create elegant deep space background like real space photography
    const centerX = this.canvas.width / 2
    const centerY = this.canvas.height / 2

    // Base deep space gradient - more realistic colors
    const baseGradient = this.ctx.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      this.canvas.width * 0.7
    )
    baseGradient.addColorStop(0, "#0a0a2e") // Deep navy center
    baseGradient.addColorStop(0.4, "#0d0d1a") // Dark navy
    baseGradient.addColorStop(0.8, "#000011") // Very dark blue
    baseGradient.addColorStop(1, "#000000") // Pure black

    this.ctx.fillStyle = baseGradient
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // Add very subtle cosmic background radiation
    this.ctx.save()
    this.ctx.globalAlpha = 0.03
    const subtleGradient = this.ctx.createRadialGradient(
      centerX,
      centerY,
      0,
      centerX,
      centerY,
      this.canvas.width * 0.5
    )
    subtleGradient.addColorStop(0, "rgba(255, 255, 255, 0.1)")
    subtleGradient.addColorStop(1, "rgba(255, 255, 255, 0)")

    this.ctx.fillStyle = subtleGradient
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.restore()
  }

  private drawRealisticStars(time: number): void {
    // Draw realistic stars like actual space photography
    const starColors = ["#ffffff", "#f0f8ff", "#e6f3ff", "#f5f5dc"]

    for (let layer = 1; layer <= 3; layer++) {
      const count = layer === 1 ? 60 : layer === 2 ? 40 : 25
      const speed = layer * 0.3
      const baseSize = layer * 0.8

      for (let i = 0; i < count; i++) {
        const seed = i * 37 + layer * 73
        const x = (seed * 17) % this.canvas.width
        const y = ((seed * 23 + time * speed) % (this.canvas.height + 100)) - 50

        // Subtle twinkling effect
        const twinkle = Math.sin(time * 1.5 + seed) * 0.2 + 0.8
        const colorIndex = Math.floor(
          ((Math.sin(seed) + 1) * starColors.length) / 2
        )
        const color = starColors[colorIndex % starColors.length]
        const size = baseSize * twinkle

        // Only draw if star is visible
        if (y > -10 && y < this.canvas.height + 10) {
          this.ctx.globalAlpha = 0.9 * twinkle

          this.ctx.fillStyle = color
          this.ctx.beginPath()
          this.ctx.arc(x, y, size, 0, Math.PI * 2)
          this.ctx.fill()
        }
      }
    }

    this.ctx.globalAlpha = 1
  }

  private drawCosmicDust(time: number): void {
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.1)"

    for (let i = 0; i < 200; i++) {
      const seed = i * 47
      const x = (seed * 13 + time * 5) % this.canvas.width
      const y = (seed * 19 + time * 3) % this.canvas.height
      const size = 0.5 + Math.sin(time + seed) * 0.3

      this.ctx.beginPath()
      this.ctx.arc(x, y, size, 0, Math.PI * 2)
      this.ctx.fill()
    }
  }

  private drawPlayer(
    x: number,
    y: number,
    size: number,
    health: number,
    powerLevel: number,
    growthLevel: number
  ): void {
    // Draw realistic player spaceship with growth levels
    this.ctx.save()
    this.ctx.translate(x, y)

    const time = Date.now() * 0.001
    const healthPercent = health / 100.0

    // Base ship size scales with growth level
    const baseSize = size * (1 + growthLevel * 0.2)
    const finalSize = baseSize * (0.7 + healthPercent * 0.3) // Shrink when damaged

    // Draw different ship designs based on growth level
    switch (Math.floor(growthLevel)) {
      case 0:
        this.drawBasicShip(finalSize, time, healthPercent, powerLevel)
        break
      case 1:
        this.drawEnhancedShip(finalSize, time, healthPercent, powerLevel)
        break
      case 2:
        this.drawAdvancedShip(finalSize, time, healthPercent, powerLevel)
        break
      case 3:
        this.drawEliteShip(finalSize, time, healthPercent, powerLevel)
        break
      case 4:
      case 5:
        this.drawLegendaryShip(finalSize, time, healthPercent, powerLevel)
        break
      default:
        this.drawBasicShip(finalSize, time, healthPercent, powerLevel)
    }

    // Warp core effect when moving forward
    if (this.isMovingForward) {
      this.drawWarpCoreEffect(finalSize, time)
    }

    this.ctx.restore()

    // Draw growth level indicator
    if (growthLevel > 0) {
      this.ctx.fillStyle = "#00ff00"
      this.ctx.font = "bold 12px Arial"
      this.ctx.textAlign = "center"
      this.ctx.fillText(`L${Math.floor(growthLevel)}`, x, y - finalSize - 15)
    }

    // Draw power level indicator
    if (powerLevel > 1) {
      this.ctx.fillStyle = "#ffeb3b"
      this.ctx.font = "bold 12px Arial"
      this.ctx.textAlign = "center"
      this.ctx.fillText(`P${powerLevel}`, x, y - finalSize - 30)
    }
  }

  private drawBasicShip(
    size: number,
    time: number,
    healthPercent: number,
    powerLevel: number
  ): void {
    // Level 0: Basic fighter - simple and clean
    const hullGradient = this.ctx.createLinearGradient(0, -size, 0, size * 0.8)
    hullGradient.addColorStop(0, "#4fc3f7") // Light blue top
    hullGradient.addColorStop(0.5, "#29b6f6") // Medium blue middle
    hullGradient.addColorStop(1, "#0277bd") // Dark blue bottom

    this.ctx.fillStyle = hullGradient
    this.ctx.beginPath()
    // Main body
    this.ctx.moveTo(0, -size * 0.9)
    this.ctx.lineTo(-size * 0.4, -size * 0.3)
    this.ctx.lineTo(-size * 0.6, size * 0.2)
    this.ctx.lineTo(-size * 0.3, size * 0.6)
    this.ctx.lineTo(size * 0.3, size * 0.6)
    this.ctx.lineTo(size * 0.6, size * 0.2)
    this.ctx.lineTo(size * 0.4, -size * 0.3)
    this.ctx.closePath()
    this.ctx.fill()

    // Cockpit
    const cockpitGradient = this.ctx.createRadialGradient(
      0,
      -size * 0.2,
      0,
      0,
      -size * 0.2,
      size * 0.3
    )
    cockpitGradient.addColorStop(0, "#e1f5fe")
    cockpitGradient.addColorStop(0.7, "#81d4fa")
    cockpitGradient.addColorStop(1, "#0288d1")

    this.ctx.fillStyle = cockpitGradient
    this.ctx.beginPath()
    this.ctx.ellipse(
      0,
      -size * 0.2,
      size * 0.25,
      size * 0.15,
      0,
      0,
      Math.PI * 2
    )
    this.ctx.fill()

    // Wings
    this.ctx.fillStyle = "#0277bd"
    this.ctx.beginPath()
    // Left wing
    this.ctx.moveTo(-size * 0.4, -size * 0.3)
    this.ctx.lineTo(-size * 0.8, -size * 0.1)
    this.ctx.lineTo(-size * 0.7, size * 0.1)
    this.ctx.lineTo(-size * 0.6, size * 0.2)
    this.ctx.closePath()
    this.ctx.fill()

    // Right wing
    this.ctx.beginPath()
    this.ctx.moveTo(size * 0.4, -size * 0.3)
    this.ctx.lineTo(size * 0.8, -size * 0.1)
    this.ctx.lineTo(size * 0.7, size * 0.1)
    this.ctx.lineTo(size * 0.6, size * 0.2)
    this.ctx.closePath()
    this.ctx.fill()

    // Engine
    this.drawEngine(size, time)

    // Basic weapons
    this.drawWeapons(size, powerLevel)

    // Shield effect (if health is low)
    if (healthPercent < 0.3) {
      this.drawShield(size, time)
    }
  }

  private drawEnhancedShip(
    size: number,
    time: number,
    healthPercent: number,
    powerLevel: number
  ): void {
    // Level 1: Enhanced fighter - more angular and aggressive
    const hullGradient = this.ctx.createLinearGradient(0, -size, 0, size * 0.8)
    hullGradient.addColorStop(0, "#00bcd4") // Cyan top
    hullGradient.addColorStop(0.5, "#0097a7") // Darker cyan middle
    hullGradient.addColorStop(1, "#006064") // Dark cyan bottom

    this.ctx.fillStyle = hullGradient
    this.ctx.beginPath()
    // Enhanced body with more angles
    this.ctx.moveTo(0, -size * 1.0)
    this.ctx.lineTo(-size * 0.5, -size * 0.4)
    this.ctx.lineTo(-size * 0.7, size * 0.1)
    this.ctx.lineTo(-size * 0.4, size * 0.7)
    this.ctx.lineTo(size * 0.4, size * 0.7)
    this.ctx.lineTo(size * 0.7, size * 0.1)
    this.ctx.lineTo(size * 0.5, -size * 0.4)
    this.ctx.closePath()
    this.ctx.fill()

    // Enhanced cockpit
    const cockpitGradient = this.ctx.createRadialGradient(
      0,
      -size * 0.3,
      0,
      0,
      -size * 0.3,
      size * 0.35
    )
    cockpitGradient.addColorStop(0, "#e0f7fa")
    cockpitGradient.addColorStop(0.7, "#80deea")
    cockpitGradient.addColorStop(1, "#00acc1")

    this.ctx.fillStyle = cockpitGradient
    this.ctx.beginPath()
    this.ctx.ellipse(0, -size * 0.3, size * 0.3, size * 0.18, 0, 0, Math.PI * 2)
    this.ctx.fill()

    // Enhanced wings with fins
    this.ctx.fillStyle = "#006064"
    this.ctx.beginPath()
    // Left wing with fin
    this.ctx.moveTo(-size * 0.5, -size * 0.4)
    this.ctx.lineTo(-size * 0.9, -size * 0.2)
    this.ctx.lineTo(-size * 0.8, size * 0.2)
    this.ctx.lineTo(-size * 0.7, size * 0.1)
    this.ctx.closePath()
    this.ctx.fill()

    // Right wing with fin
    this.ctx.beginPath()
    this.ctx.moveTo(size * 0.5, -size * 0.4)
    this.ctx.lineTo(size * 0.9, -size * 0.2)
    this.ctx.lineTo(size * 0.8, size * 0.2)
    this.ctx.lineTo(size * 0.7, size * 0.1)
    this.ctx.closePath()
    this.ctx.fill()

    // Engine
    this.drawEngine(size, time)

    // Enhanced weapons
    this.drawWeapons(size, powerLevel)

    // Shield effect (if health is low)
    if (healthPercent < 0.3) {
      this.drawShield(size, time)
    }
  }

  private drawAdvancedShip(
    size: number,
    time: number,
    healthPercent: number,
    powerLevel: number
  ): void {
    // Level 2: Advanced fighter - sleek and modern
    const hullGradient = this.ctx.createLinearGradient(0, -size, 0, size * 0.8)
    hullGradient.addColorStop(0, "#9c27b0") // Purple top
    hullGradient.addColorStop(0.5, "#7b1fa2") // Darker purple middle
    hullGradient.addColorStop(1, "#4a148c") // Dark purple bottom

    this.ctx.fillStyle = hullGradient
    this.ctx.beginPath()
    // Advanced body with curves
    this.ctx.moveTo(0, -size * 1.1)
    this.ctx.lineTo(-size * 0.6, -size * 0.5)
    this.ctx.lineTo(-size * 0.8, size * 0.0)
    this.ctx.lineTo(-size * 0.5, size * 0.8)
    this.ctx.lineTo(size * 0.5, size * 0.8)
    this.ctx.lineTo(size * 0.8, size * 0.0)
    this.ctx.lineTo(size * 0.6, -size * 0.5)
    this.ctx.closePath()
    this.ctx.fill()

    // Advanced cockpit with glow
    const cockpitGradient = this.ctx.createRadialGradient(
      0,
      -size * 0.4,
      0,
      0,
      -size * 0.4,
      size * 0.4
    )
    cockpitGradient.addColorStop(0, "#f3e5f5")
    cockpitGradient.addColorStop(0.7, "#ce93d8")
    cockpitGradient.addColorStop(1, "#ab47bc")

    this.ctx.fillStyle = cockpitGradient
    this.ctx.beginPath()
    this.ctx.ellipse(0, -size * 0.4, size * 0.35, size * 0.2, 0, 0, Math.PI * 2)
    this.ctx.fill()

    // Advanced wings with energy fins
    this.ctx.fillStyle = "#4a148c"
    this.ctx.beginPath()
    // Left wing with energy fin
    this.ctx.moveTo(-size * 0.6, -size * 0.5)
    this.ctx.lineTo(-size * 1.0, -size * 0.3)
    this.ctx.lineTo(-size * 0.9, size * 0.3)
    this.ctx.lineTo(-size * 0.8, size * 0.0)
    this.ctx.closePath()
    this.ctx.fill()

    // Right wing with energy fin
    this.ctx.beginPath()
    this.ctx.moveTo(size * 0.6, -size * 0.5)
    this.ctx.lineTo(size * 1.0, -size * 0.3)
    this.ctx.lineTo(size * 0.9, size * 0.3)
    this.ctx.lineTo(size * 0.8, size * 0.0)
    this.ctx.closePath()
    this.ctx.fill()

    // Energy fins glow
    this.ctx.strokeStyle = `rgba(156, 39, 176, ${
      0.6 + Math.sin(time * 8) * 0.2
    })`
    this.ctx.lineWidth = 2
    this.ctx.beginPath()
    this.ctx.moveTo(-size * 0.8, size * 0.0)
    this.ctx.lineTo(-size * 1.2, size * 0.4)
    this.ctx.moveTo(size * 0.8, size * 0.0)
    this.ctx.lineTo(size * 1.2, size * 0.4)
    this.ctx.stroke()

    // Engine
    this.drawEngine(size, time)

    // Advanced weapons
    this.drawWeapons(size, powerLevel)

    // Shield effect (if health is low)
    if (healthPercent < 0.3) {
      this.drawShield(size, time)
    }
  }

  private drawEliteShip(
    size: number,
    time: number,
    healthPercent: number,
    powerLevel: number
  ): void {
    // Level 3: Elite fighter - powerful and intimidating
    const hullGradient = this.ctx.createLinearGradient(0, -size, 0, size * 0.8)
    hullGradient.addColorStop(0, "#ff9800") // Orange top
    hullGradient.addColorStop(0.5, "#f57c00") // Darker orange middle
    hullGradient.addColorStop(1, "#e65100") // Dark orange bottom

    this.ctx.fillStyle = hullGradient
    this.ctx.beginPath()
    // Elite body with aggressive angles
    this.ctx.moveTo(0, -size * 1.2)
    this.ctx.lineTo(-size * 0.7, -size * 0.6)
    this.ctx.lineTo(-size * 0.9, size * 0.1)
    this.ctx.lineTo(-size * 0.6, size * 0.9)
    this.ctx.lineTo(size * 0.6, size * 0.9)
    this.ctx.lineTo(size * 0.9, size * 0.1)
    this.ctx.lineTo(size * 0.7, -size * 0.6)
    this.ctx.closePath()
    this.ctx.fill()

    // Elite cockpit with energy field
    const cockpitGradient = this.ctx.createRadialGradient(
      0,
      -size * 0.5,
      0,
      0,
      -size * 0.5,
      size * 0.45
    )
    cockpitGradient.addColorStop(0, "#fff3e0")
    cockpitGradient.addColorStop(0.7, "#ffcc02")
    cockpitGradient.addColorStop(1, "#ff9800")

    this.ctx.fillStyle = cockpitGradient
    this.ctx.beginPath()
    this.ctx.ellipse(0, -size * 0.5, size * 0.4, size * 0.25, 0, 0, Math.PI * 2)
    this.ctx.fill()

    // Elite wings with plasma fins
    this.ctx.fillStyle = "#e65100"
    this.ctx.beginPath()
    // Left wing with plasma fin
    this.ctx.moveTo(-size * 0.7, -size * 0.6)
    this.ctx.lineTo(-size * 1.1, -size * 0.4)
    this.ctx.lineTo(-size * 1.0, size * 0.4)
    this.ctx.lineTo(-size * 0.9, size * 0.1)
    this.ctx.closePath()
    this.ctx.fill()

    // Right wing with plasma fin
    this.ctx.beginPath()
    this.ctx.moveTo(size * 0.7, -size * 0.6)
    this.ctx.lineTo(size * 1.1, -size * 0.4)
    this.ctx.lineTo(size * 1.0, size * 0.4)
    this.ctx.lineTo(size * 0.9, size * 0.1)
    this.ctx.closePath()
    this.ctx.fill()

    // Plasma fins with intense glow
    this.ctx.strokeStyle = `rgba(255, 152, 0, ${
      0.8 + Math.sin(time * 10) * 0.2
    })`
    this.ctx.lineWidth = 3
    this.ctx.beginPath()
    this.ctx.moveTo(-size * 0.9, size * 0.1)
    this.ctx.lineTo(-size * 1.4, size * 0.6)
    this.ctx.moveTo(size * 0.9, size * 0.1)
    this.ctx.lineTo(size * 1.4, size * 0.6)
    this.ctx.stroke()

    // Engine
    this.drawEngine(size, time)

    // Elite weapons
    this.drawWeapons(size, powerLevel)

    // Shield effect (if health is low)
    if (healthPercent < 0.3) {
      this.drawShield(size, time)
    }
  }

  private drawLegendaryShip(
    size: number,
    time: number,
    healthPercent: number,
    powerLevel: number
  ): void {
    // Level 4-5: Legendary fighter - ultimate design
    const hullGradient = this.ctx.createLinearGradient(0, -size, 0, size * 0.8)
    hullGradient.addColorStop(0, "#e91e63") // Pink top
    hullGradient.addColorStop(0.3, "#c2185b") // Darker pink
    hullGradient.addColorStop(0.7, "#ad1457") // Even darker
    hullGradient.addColorStop(1, "#880e4f") // Darkest pink bottom

    this.ctx.fillStyle = hullGradient
    this.ctx.beginPath()
    // Legendary body with ultimate design
    this.ctx.moveTo(0, -size * 1.3)
    this.ctx.lineTo(-size * 0.8, -size * 0.7)
    this.ctx.lineTo(-size * 1.0, size * 0.2)
    this.ctx.lineTo(-size * 0.7, size * 1.0)
    this.ctx.lineTo(size * 0.7, size * 1.0)
    this.ctx.lineTo(size * 1.0, size * 0.2)
    this.ctx.lineTo(size * 0.8, -size * 0.7)
    this.ctx.closePath()
    this.ctx.fill()

    // Legendary cockpit with energy core
    const cockpitGradient = this.ctx.createRadialGradient(
      0,
      -size * 0.6,
      0,
      0,
      -size * 0.6,
      size * 0.5
    )
    cockpitGradient.addColorStop(0, "#fce4ec")
    cockpitGradient.addColorStop(0.5, "#f8bbd9")
    cockpitGradient.addColorStop(0.8, "#f48fb1")
    cockpitGradient.addColorStop(1, "#e91e63")

    this.ctx.fillStyle = cockpitGradient
    this.ctx.beginPath()
    this.ctx.ellipse(0, -size * 0.6, size * 0.45, size * 0.3, 0, 0, Math.PI * 2)
    this.ctx.fill()

    // Legendary wings with quantum fins
    this.ctx.fillStyle = "#880e4f"
    this.ctx.beginPath()
    // Left wing with quantum fin
    this.ctx.moveTo(-size * 0.8, -size * 0.7)
    this.ctx.lineTo(-size * 1.2, -size * 0.5)
    this.ctx.lineTo(-size * 1.1, size * 0.5)
    this.ctx.lineTo(-size * 1.0, size * 0.2)
    this.ctx.closePath()
    this.ctx.fill()

    // Right wing with quantum fin
    this.ctx.beginPath()
    this.ctx.moveTo(size * 0.8, -size * 0.7)
    this.ctx.lineTo(size * 1.2, -size * 0.5)
    this.ctx.lineTo(size * 1.1, size * 0.5)
    this.ctx.lineTo(size * 1.0, size * 0.2)
    this.ctx.closePath()
    this.ctx.fill()

    // Quantum fins with pulsing energy
    this.ctx.strokeStyle = `rgba(233, 30, 99, ${
      0.9 + Math.sin(time * 12) * 0.1
    })`
    this.ctx.lineWidth = 4
    this.ctx.beginPath()
    this.ctx.moveTo(-size * 1.0, size * 0.2)
    this.ctx.lineTo(-size * 1.6, size * 0.8)
    this.ctx.moveTo(size * 1.0, size * 0.2)
    this.ctx.lineTo(size * 1.6, size * 0.8)
    this.ctx.stroke()

    // Energy aura around the ship
    this.ctx.strokeStyle = `rgba(233, 30, 99, ${
      0.3 + Math.sin(time * 6) * 0.2
    })`
    this.ctx.lineWidth = 2
    this.ctx.beginPath()
    this.ctx.ellipse(0, 0, size * 1.4, size * 1.4, 0, 0, Math.PI * 2)
    this.ctx.stroke()

    // Engine
    this.drawEngine(size, time)

    // Legendary weapons
    this.drawWeapons(size, powerLevel)

    // Shield effect (if health is low)
    if (healthPercent < 0.3) {
      this.drawShield(size, time)
    }
  }

  private drawEngine(size: number, time: number): void {
    // Engine exhaust with animation
    const engineGlow = Math.sin(time * 10) * 0.3 + 0.7
    const engineGradient = this.ctx.createRadialGradient(
      0,
      size * 0.6,
      0,
      0,
      size * 0.6,
      size * 0.4
    )
    engineGradient.addColorStop(0, `rgba(255, 152, 0, ${engineGlow})`)
    engineGradient.addColorStop(0.5, `rgba(255, 87, 34, ${engineGlow * 0.7})`)
    engineGradient.addColorStop(1, "rgba(255, 87, 34, 0)")

    this.ctx.fillStyle = engineGradient
    this.ctx.beginPath()
    this.ctx.ellipse(0, size * 0.6, size * 0.3, size * 0.2, 0, 0, Math.PI * 2)
    this.ctx.fill()

    // Engine details
    this.ctx.fillStyle = "#424242"
    this.ctx.beginPath()
    this.ctx.ellipse(0, size * 0.6, size * 0.15, size * 0.1, 0, 0, Math.PI * 2)
    this.ctx.fill()
  }

  private drawWeapons(size: number, powerLevel: number): void {
    // Weapon systems (based on power level)
    if (powerLevel >= 2) {
      this.ctx.fillStyle = "#ffeb3b"
      // Left weapon
      this.ctx.beginPath()
      this.ctx.ellipse(
        -size * 0.3,
        -size * 0.1,
        size * 0.08,
        size * 0.05,
        0,
        0,
        Math.PI * 2
      )
      this.ctx.fill()
      // Right weapon
      this.ctx.beginPath()
      this.ctx.ellipse(
        size * 0.3,
        -size * 0.1,
        size * 0.08,
        size * 0.05,
        0,
        0,
        Math.PI * 2
      )
      this.ctx.fill()
    }

    if (powerLevel >= 3) {
      this.ctx.fillStyle = "#ff9800"
      // Center weapon
      this.ctx.beginPath()
      this.ctx.ellipse(
        0,
        -size * 0.05,
        size * 0.1,
        size * 0.06,
        0,
        0,
        Math.PI * 2
      )
      this.ctx.fill()
    }
  }

  private drawShield(size: number, time: number): void {
    // Shield effect (if health is low)
    this.ctx.strokeStyle = `rgba(255, 193, 7, ${
      0.5 + Math.sin(time * 5) * 0.3
    })`
    this.ctx.lineWidth = 2
    this.ctx.beginPath()
    this.ctx.ellipse(0, 0, size * 1.2, size * 1.2, 0, 0, Math.PI * 2)
    this.ctx.stroke()
  }

  private drawEnergyShield(
    x: number,
    y: number,
    shipSize: number,
    shieldLevel: number,
    shieldTimer: number,
    time: number
  ): void {
    // Draw beautiful energy shield in front of the spaceship
    this.ctx.save()
    this.ctx.translate(x, y)

    // Shield size and position based on level
    const shieldSize = shipSize * (1.3 + shieldLevel * 0.15) // Bigger shield for higher levels
    const shieldOffset = -shipSize * 0.7 // Position in front of ship

    // Enhanced shield colors based on level with more vibrant effects
    let shieldColor: string
    let glowColor: string
    let accentColor: string
    switch (shieldLevel) {
      case 1:
        shieldColor = "rgba(0, 255, 255, 0.7)" // Bright Cyan
        glowColor = "rgba(0, 255, 255, 0.4)"
        accentColor = "rgba(0, 200, 200, 1.0)"
        break
      case 2:
        shieldColor = "rgba(64, 156, 255, 0.8)" // Electric Blue
        glowColor = "rgba(64, 156, 255, 0.5)"
        accentColor = "rgba(100, 180, 255, 1.0)"
        break
      case 3:
        shieldColor = "rgba(255, 64, 255, 0.9)" // Magenta
        glowColor = "rgba(255, 64, 255, 0.6)"
        accentColor = "rgba(255, 100, 255, 1.0)"
        break
      default:
        shieldColor = "rgba(0, 255, 255, 0.7)"
        glowColor = "rgba(0, 255, 255, 0.4)"
        accentColor = "rgba(0, 200, 200, 1.0)"
    }

    // Enhanced animated effects
    const timeRemaining = Math.max(0, shieldTimer) / 10.0
    const pulseEffect = Math.sin(time * 12) * 0.15 + 0.85
    const rotationEffect = Math.sin(time * 6) * 0.1
    const shieldOpacity = 0.7 + Math.sin(time * 10) * 0.2

    // Create gradient for the shield
    const shieldGradient = this.ctx.createRadialGradient(
      0,
      shieldOffset,
      0,
      0,
      shieldOffset,
      shieldSize
    )
    shieldGradient.addColorStop(
      0,
      shieldColor.replace("0.7", (shieldOpacity * 0.9).toString())
    )
    shieldGradient.addColorStop(
      0.7,
      shieldColor.replace("0.7", (shieldOpacity * 0.6).toString())
    )
    shieldGradient.addColorStop(1, shieldColor.replace("0.7", "0.1"))

    // Draw outer glow effect (multiple layers)
    for (let i = 3; i >= 1; i--) {
      this.ctx.fillStyle = glowColor.replace(
        "0.4",
        (0.1 * i * pulseEffect).toString()
      )
      this.ctx.beginPath()
      this.ctx.ellipse(
        0,
        shieldOffset,
        shieldSize * (1.4 + i * 0.2),
        shieldSize * (0.9 + i * 0.1),
        rotationEffect,
        0,
        Math.PI * 2
      )
      this.ctx.fill()
    }

    // Draw main shield with gradient
    this.ctx.fillStyle = shieldGradient
    this.ctx.beginPath()
    this.ctx.ellipse(
      0,
      shieldOffset,
      shieldSize,
      shieldSize * 0.7,
      rotationEffect,
      0,
      Math.PI * 2
    )
    this.ctx.fill()

    // Draw shield border with animated thickness
    const borderWidth = 3 + Math.sin(time * 8) * 1
    this.ctx.strokeStyle = accentColor
    this.ctx.lineWidth = borderWidth
    this.ctx.beginPath()
    this.ctx.ellipse(
      0,
      shieldOffset,
      shieldSize,
      shieldSize * 0.7,
      rotationEffect,
      0,
      Math.PI * 2
    )
    this.ctx.stroke()

    // Draw inner shield ring
    this.ctx.strokeStyle = accentColor.replace("1.0", "0.6")
    this.ctx.lineWidth = 1
    this.ctx.beginPath()
    this.ctx.ellipse(
      0,
      shieldOffset,
      shieldSize * 0.8,
      shieldSize * 0.6,
      rotationEffect,
      0,
      Math.PI * 2
    )
    this.ctx.stroke()

    // Enhanced energy particles with trails
    const particleCount = shieldLevel * 4
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + time * 4
      const distance = shieldSize * (0.7 + Math.sin(time * 3 + i) * 0.3)
      const particleX = Math.cos(angle) * distance
      const particleY = Math.sin(angle) * distance + shieldOffset
      const particleSize = (2 + Math.sin(time * 15 + i) * 1) * pulseEffect

      // Draw particle trail
      this.ctx.strokeStyle = accentColor.replace("1.0", "0.4")
      this.ctx.lineWidth = 1
      this.ctx.beginPath()
      this.ctx.moveTo(particleX, particleY)
      this.ctx.lineTo(
        particleX - Math.cos(angle) * particleSize * 2,
        particleY - Math.sin(angle) * particleSize * 2
      )
      this.ctx.stroke()

      // Draw particle
      this.ctx.fillStyle = accentColor
      this.ctx.beginPath()
      this.ctx.arc(particleX, particleY, particleSize, 0, Math.PI * 2)
      this.ctx.fill()
    }

    // Draw energy waves
    for (let i = 0; i < 3; i++) {
      const waveSize = shieldSize * (1.1 + i * 0.1)
      const waveOpacity = (0.3 - i * 0.1) * pulseEffect
      this.ctx.strokeStyle = accentColor.replace("1.0", waveOpacity.toString())
      this.ctx.lineWidth = 2
      this.ctx.beginPath()
      this.ctx.ellipse(
        0,
        shieldOffset,
        waveSize,
        waveSize * 0.7,
        rotationEffect + time * 2,
        0,
        Math.PI * 2
      )
      this.ctx.stroke()
    }

    // Draw shield level indicator with glow
    this.ctx.shadowColor = accentColor
    this.ctx.shadowBlur = 10
    this.ctx.fillStyle = accentColor
    this.ctx.font = "bold 16px Arial"
    this.ctx.textAlign = "center"
    this.ctx.fillText(`${shieldLevel}`, 0, shieldOffset + 8)
    this.ctx.shadowBlur = 0

    // Draw shield status indicator
    const statusText = shieldTimer > 0 ? `${shieldTimer.toFixed(1)}s` : "ACTIVE"
    this.ctx.fillStyle = accentColor.replace("1.0", "0.8")
    this.ctx.font = "bold 10px Arial"
    this.ctx.fillText(statusText, 0, shieldOffset + 25)

    this.ctx.restore()
  }

  private drawBlackHole(
    x: number,
    y: number,
    size: number,
    lifeRatio: number,
    pullRadius: number
  ): void {
    // Draw epic black hole effect
    this.ctx.save()
    this.ctx.translate(x, y)

    const time = Date.now() * 0.001

    // Black hole core - pure darkness
    const coreGradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, size)
    coreGradient.addColorStop(0, "rgba(0, 0, 0, 1)")
    coreGradient.addColorStop(0.3, "rgba(20, 20, 20, 0.9)")
    coreGradient.addColorStop(0.7, "rgba(40, 40, 40, 0.7)")
    coreGradient.addColorStop(1, "rgba(60, 60, 60, 0.3)")

    this.ctx.fillStyle = coreGradient
    this.ctx.beginPath()
    this.ctx.arc(0, 0, size, 0, Math.PI * 2)
    this.ctx.fill()

    // Event horizon ring
    const eventHorizonSize = size * (1 + Math.sin(time * 8) * 0.1)
    this.ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 * lifeRatio})`
    this.ctx.lineWidth = 3
    this.ctx.beginPath()
    this.ctx.arc(0, 0, eventHorizonSize, 0, Math.PI * 2)
    this.ctx.stroke()

    // Gravitational lensing effect
    const lensingCount = 8
    for (let i = 0; i < lensingCount; i++) {
      const angle = (i / lensingCount) * Math.PI * 2 + time * 2
      const lensingSize = size * (1.5 + i * 0.3)
      const lensingOpacity = (0.3 - i * 0.03) * lifeRatio

      this.ctx.strokeStyle = `rgba(255, 255, 255, ${lensingOpacity})`
      this.ctx.lineWidth = 1
      this.ctx.beginPath()
      this.ctx.ellipse(
        0,
        0,
        lensingSize,
        lensingSize * 0.3,
        angle,
        0,
        Math.PI * 2
      )
      this.ctx.stroke()
    }

    // Pull radius indicator (subtle)
    this.ctx.strokeStyle = `rgba(255, 255, 255, ${0.1 * lifeRatio})`
    this.ctx.lineWidth = 1
    this.ctx.beginPath()
    this.ctx.arc(0, 0, pullRadius, 0, Math.PI * 2)
    this.ctx.stroke()

    // Swirling particles around the black hole
    const particleCount = Math.floor(20 * lifeRatio)
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + time * 5
      const distance = size * (1.2 + Math.sin(time * 3 + i) * 0.3)
      const particleX = Math.cos(angle) * distance
      const particleY = Math.sin(angle) * distance
      const particleSize = (1 + Math.sin(time * 10 + i) * 0.5) * lifeRatio

      this.ctx.fillStyle = `rgba(255, 255, 255, ${0.6 * lifeRatio})`
      this.ctx.beginPath()
      this.ctx.arc(particleX, particleY, particleSize, 0, Math.PI * 2)
      this.ctx.fill()
    }

    // Energy distortion waves
    for (let i = 0; i < 3; i++) {
      const waveSize = size * (2 + i * 0.5) + Math.sin(time * 4 + i) * 10
      const waveOpacity = (0.2 - i * 0.05) * lifeRatio

      this.ctx.strokeStyle = `rgba(255, 255, 255, ${waveOpacity})`
      this.ctx.lineWidth = 2
      this.ctx.beginPath()
      this.ctx.arc(0, 0, waveSize, 0, Math.PI * 2)
      this.ctx.stroke()
    }

    this.ctx.restore()
  }

  private drawWarpCoreEffect(size: number, time: number): void {
    // Clean propulsion tail effect
    this.ctx.save()

    // Energy trails behind the ship
    const trailCount = 8
    for (let i = 0; i < trailCount; i++) {
      const trailLength = size * 2.5
      const trailWidth = size * 0.25 * (1 - i / trailCount)
      const trailY = size * 0.6 + (i * trailLength) / trailCount
      const trailOpacity = (1 - i / trailCount) * 0.9

      // Blue energy trail
      const trailGradient = this.ctx.createLinearGradient(
        0,
        trailY,
        0,
        trailY + trailLength / trailCount
      )
      trailGradient.addColorStop(0, `rgba(0, 150, 255, ${trailOpacity})`)
      trailGradient.addColorStop(
        0.5,
        `rgba(0, 200, 255, ${trailOpacity * 0.7})`
      )
      trailGradient.addColorStop(1, `rgba(0, 150, 255, 0)`)

      this.ctx.fillStyle = trailGradient
      this.ctx.beginPath()
      this.ctx.ellipse(
        0,
        trailY,
        trailWidth,
        trailLength / trailCount / 2,
        0,
        0,
        Math.PI * 2
      )
      this.ctx.fill()
    }

    // Propulsion glow at the engine
    const engineGlow = Math.sin(time * 10) * 0.3 + 0.7
    const glowGradient = this.ctx.createRadialGradient(
      0,
      size * 0.6,
      0,
      0,
      size * 0.6,
      size * 0.6
    )
    glowGradient.addColorStop(0, `rgba(0, 255, 255, ${engineGlow * 0.6})`)
    glowGradient.addColorStop(0.5, `rgba(0, 200, 255, ${engineGlow * 0.3})`)
    glowGradient.addColorStop(1, "rgba(0, 150, 255, 0)")

    this.ctx.fillStyle = glowGradient
    this.ctx.beginPath()
    this.ctx.ellipse(0, size * 0.6, size * 0.6, size * 0.4, 0, 0, Math.PI * 2)
    this.ctx.fill()

    this.ctx.restore()
  }

  private drawEnemy(
    x: number,
    y: number,
    size: number,
    health: number,
    enemyType: number
  ): void {
    // Draw realistic enemy spaceships
    this.ctx.save()
    this.ctx.translate(x, y)

    const time = Date.now() * 0.001

    switch (enemyType) {
      case 0: // Basic Fighter
        this.drawBasicFighter(size, time)
        break
      case 1: // Fast Interceptor
        this.drawFastInterceptor(size, time)
        break
      case 2: // Heavy Tank
        this.drawHeavyTank(size, time, health)
        break
      default:
        this.drawBasicFighter(size, time)
    }

    this.ctx.restore()

    // Draw health bar for tank enemies
    if (enemyType === 2) {
      const healthPercent = health / 50.0
      const barWidth = size * 2.5
      const barHeight = 6

      // Health bar background
      this.ctx.fillStyle = "rgba(0, 0, 0, 0.7)"
      this.ctx.fillRect(
        x - barWidth / 2 - 2,
        y - size - 15 - 2,
        barWidth + 4,
        barHeight + 4
      )

      this.ctx.fillStyle = "rgba(255, 0, 0, 0.5)"
      this.ctx.fillRect(x - barWidth / 2, y - size - 15, barWidth, barHeight)

      // Health bar fill
      const healthColor =
        healthPercent > 0.5
          ? "#4caf50"
          : healthPercent > 0.25
          ? "#ff9800"
          : "#f44336"
      this.ctx.fillStyle = healthColor
      this.ctx.fillRect(
        x - barWidth / 2,
        y - size - 15,
        barWidth * healthPercent,
        barHeight
      )
    }
  }

  private drawBasicFighter(size: number, time: number): void {
    // Basic enemy fighter - sleek and aggressive
    const hullGradient = this.ctx.createLinearGradient(0, -size, 0, size)
    hullGradient.addColorStop(0, "#f44336") // Red top
    hullGradient.addColorStop(0.5, "#d32f2f") // Dark red middle
    hullGradient.addColorStop(1, "#b71c1c") // Very dark red bottom

    this.ctx.fillStyle = hullGradient
    this.ctx.beginPath()
    // Main body - pointed design
    this.ctx.moveTo(0, -size * 0.8)
    this.ctx.lineTo(-size * 0.3, -size * 0.2)
    this.ctx.lineTo(-size * 0.5, size * 0.3)
    this.ctx.lineTo(-size * 0.2, size * 0.6)
    this.ctx.lineTo(size * 0.2, size * 0.6)
    this.ctx.lineTo(size * 0.5, size * 0.3)
    this.ctx.lineTo(size * 0.3, -size * 0.2)
    this.ctx.closePath()
    this.ctx.fill()

    // Cockpit
    this.ctx.fillStyle = "#ffcdd2"
    this.ctx.beginPath()
    this.ctx.ellipse(0, -size * 0.1, size * 0.15, size * 0.1, 0, 0, Math.PI * 2)
    this.ctx.fill()

    // Wings
    this.ctx.fillStyle = "#b71c1c"
    this.ctx.beginPath()
    // Left wing
    this.ctx.moveTo(-size * 0.3, -size * 0.2)
    this.ctx.lineTo(-size * 0.6, -size * 0.1)
    this.ctx.lineTo(-size * 0.5, size * 0.2)
    this.ctx.lineTo(-size * 0.5, size * 0.3)
    this.ctx.closePath()
    this.ctx.fill()

    // Right wing
    this.ctx.beginPath()
    this.ctx.moveTo(size * 0.3, -size * 0.2)
    this.ctx.lineTo(size * 0.6, -size * 0.1)
    this.ctx.lineTo(size * 0.5, size * 0.2)
    this.ctx.lineTo(size * 0.5, size * 0.3)
    this.ctx.closePath()
    this.ctx.fill()

    // Engine glow
    const engineGlow = Math.sin(time * 8) * 0.4 + 0.6
    this.ctx.fillStyle = `rgba(255, 87, 34, ${engineGlow})`
    this.ctx.beginPath()
    this.ctx.ellipse(0, size * 0.6, size * 0.2, size * 0.15, 0, 0, Math.PI * 2)
    this.ctx.fill()
  }

  private drawFastInterceptor(size: number, time: number): void {
    // Fast interceptor - streamlined and dangerous
    const hullGradient = this.ctx.createLinearGradient(0, -size, 0, size)
    hullGradient.addColorStop(0, "#ff9800") // Orange top
    hullGradient.addColorStop(0.5, "#f57c00") // Dark orange middle
    hullGradient.addColorStop(1, "#e65100") // Very dark orange bottom

    this.ctx.fillStyle = hullGradient
    this.ctx.beginPath()
    // Main body - very streamlined
    this.ctx.moveTo(0, -size * 0.9)
    this.ctx.lineTo(-size * 0.2, -size * 0.4)
    this.ctx.lineTo(-size * 0.4, size * 0.2)
    this.ctx.lineTo(-size * 0.15, size * 0.5)
    this.ctx.lineTo(size * 0.15, size * 0.5)
    this.ctx.lineTo(size * 0.4, size * 0.2)
    this.ctx.lineTo(size * 0.2, -size * 0.4)
    this.ctx.closePath()
    this.ctx.fill()

    // Cockpit
    this.ctx.fillStyle = "#fff3e0"
    this.ctx.beginPath()
    this.ctx.ellipse(
      0,
      -size * 0.3,
      size * 0.12,
      size * 0.08,
      0,
      0,
      Math.PI * 2
    )
    this.ctx.fill()

    // Extended wings for speed
    this.ctx.fillStyle = "#e65100"
    this.ctx.beginPath()
    // Left wing
    this.ctx.moveTo(-size * 0.2, -size * 0.4)
    this.ctx.lineTo(-size * 0.7, -size * 0.2)
    this.ctx.lineTo(-size * 0.6, size * 0.1)
    this.ctx.lineTo(-size * 0.4, size * 0.2)
    this.ctx.closePath()
    this.ctx.fill()

    // Right wing
    this.ctx.beginPath()
    this.ctx.moveTo(size * 0.2, -size * 0.4)
    this.ctx.lineTo(size * 0.7, -size * 0.2)
    this.ctx.lineTo(size * 0.6, size * 0.1)
    this.ctx.lineTo(size * 0.4, size * 0.2)
    this.ctx.closePath()
    this.ctx.fill()

    // Dual engine glow
    const engineGlow = Math.sin(time * 12) * 0.5 + 0.5
    this.ctx.fillStyle = `rgba(255, 152, 0, ${engineGlow})`
    // Left engine
    this.ctx.beginPath()
    this.ctx.ellipse(
      -size * 0.15,
      size * 0.5,
      size * 0.15,
      size * 0.1,
      0,
      0,
      Math.PI * 2
    )
    this.ctx.fill()
    // Right engine
    this.ctx.beginPath()
    this.ctx.ellipse(
      size * 0.15,
      size * 0.5,
      size * 0.15,
      size * 0.1,
      0,
      0,
      Math.PI * 2
    )
    this.ctx.fill()
  }

  private drawHeavyTank(size: number, time: number, health: number): void {
    // Heavy tank - massive and armored
    const hullGradient = this.ctx.createLinearGradient(0, -size, 0, size)
    hullGradient.addColorStop(0, "#9c27b0") // Purple top
    hullGradient.addColorStop(0.5, "#7b1fa2") // Dark purple middle
    hullGradient.addColorStop(1, "#4a148c") // Very dark purple bottom

    this.ctx.fillStyle = hullGradient
    this.ctx.beginPath()
    // Main body - heavily armored
    this.ctx.moveTo(0, -size * 0.7)
    this.ctx.lineTo(-size * 0.6, -size * 0.3)
    this.ctx.lineTo(-size * 0.8, size * 0.1)
    this.ctx.lineTo(-size * 0.6, size * 0.5)
    this.ctx.lineTo(-size * 0.3, size * 0.7)
    this.ctx.lineTo(size * 0.3, size * 0.7)
    this.ctx.lineTo(size * 0.6, size * 0.5)
    this.ctx.lineTo(size * 0.8, size * 0.1)
    this.ctx.lineTo(size * 0.6, -size * 0.3)
    this.ctx.closePath()
    this.ctx.fill()

    // Armor plates
    this.ctx.fillStyle = "#4a148c"
    this.ctx.beginPath()
    this.ctx.rect(-size * 0.4, -size * 0.2, size * 0.8, size * 0.4)
    this.ctx.fill()

    // Cockpit
    this.ctx.fillStyle = "#e1bee7"
    this.ctx.beginPath()
    this.ctx.ellipse(0, -size * 0.1, size * 0.2, size * 0.12, 0, 0, Math.PI * 2)
    this.ctx.fill()

    // Heavy weapon turrets
    this.ctx.fillStyle = "#424242"
    // Left turret
    this.ctx.beginPath()
    this.ctx.ellipse(-size * 0.4, 0, size * 0.15, size * 0.1, 0, 0, Math.PI * 2)
    this.ctx.fill()
    // Right turret
    this.ctx.beginPath()
    this.ctx.ellipse(size * 0.4, 0, size * 0.15, size * 0.1, 0, 0, Math.PI * 2)
    this.ctx.fill()

    // Multiple engine exhausts
    const engineGlow = Math.sin(time * 6) * 0.3 + 0.7
    this.ctx.fillStyle = `rgba(156, 39, 176, ${engineGlow})`
    // Left engine
    this.ctx.beginPath()
    this.ctx.ellipse(
      -size * 0.3,
      size * 0.7,
      size * 0.2,
      size * 0.15,
      0,
      0,
      Math.PI * 2
    )
    this.ctx.fill()
    // Right engine
    this.ctx.beginPath()
    this.ctx.ellipse(
      size * 0.3,
      size * 0.7,
      size * 0.2,
      size * 0.15,
      0,
      0,
      Math.PI * 2
    )
    this.ctx.fill()
    // Center engine
    this.ctx.beginPath()
    this.ctx.ellipse(0, size * 0.7, size * 0.25, size * 0.18, 0, 0, Math.PI * 2)
    this.ctx.fill()

    // Shield effect (if health is high)
    if (health > 35) {
      this.ctx.strokeStyle = `rgba(156, 39, 176, ${
        0.3 + Math.sin(time * 3) * 0.2
      })`
      this.ctx.lineWidth = 3
      this.ctx.beginPath()
      this.ctx.ellipse(0, 0, size * 1.4, size * 1.4, 0, 0, Math.PI * 2)
      this.ctx.stroke()
    }
  }

  private drawBullet(
    x: number,
    y: number,
    size: number,
    isEnemy: boolean
  ): void {
    this.ctx.save()
    this.ctx.translate(x, y)

    const time = Date.now() * 0.001

    if (isEnemy) {
      // Enemy bullet - plasma projectile
      const bulletGradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, size)
      bulletGradient.addColorStop(0, "#ffeb3b") // Bright yellow core
      bulletGradient.addColorStop(0.3, "#ff9800") // Orange
      bulletGradient.addColorStop(0.7, "#f44336") // Red
      bulletGradient.addColorStop(1, "rgba(244, 67, 54, 0)") // Transparent edge

      this.ctx.fillStyle = bulletGradient
      this.ctx.beginPath()
      this.ctx.arc(0, 0, size, 0, Math.PI * 2)
      this.ctx.fill()

      // Plasma glow effect
      const glowIntensity = Math.sin(time * 15) * 0.3 + 0.7
      this.ctx.strokeStyle = `rgba(255, 235, 59, ${glowIntensity})`
      this.ctx.lineWidth = 2
      this.ctx.beginPath()
      this.ctx.arc(0, 0, size * 1.5, 0, Math.PI * 2)
      this.ctx.stroke()
    } else {
      // Player bullet - energy projectile
      const bulletGradient = this.ctx.createRadialGradient(0, 0, 0, 0, 0, size)
      bulletGradient.addColorStop(0, "#ffffff") // White core
      bulletGradient.addColorStop(0.3, "#4fc3f7") // Light blue
      bulletGradient.addColorStop(0.7, "#2196f3") // Blue
      bulletGradient.addColorStop(1, "rgba(33, 150, 243, 0)") // Transparent edge

      this.ctx.fillStyle = bulletGradient
      this.ctx.beginPath()
      this.ctx.arc(0, 0, size, 0, Math.PI * 2)
      this.ctx.fill()

      // Energy trail
      const trailLength = 8
      const trailGradient = this.ctx.createLinearGradient(0, -trailLength, 0, 0)
      trailGradient.addColorStop(0, "rgba(79, 195, 247, 0)")
      trailGradient.addColorStop(0.5, "rgba(79, 195, 247, 0.6)")
      trailGradient.addColorStop(1, "rgba(79, 195, 247, 0.8)")

      this.ctx.fillStyle = trailGradient
      this.ctx.beginPath()
      this.ctx.ellipse(
        0,
        -trailLength / 2,
        size * 0.8,
        trailLength / 2,
        0,
        0,
        Math.PI * 2
      )
      this.ctx.fill()

      // Energy glow effect
      const glowIntensity = Math.sin(time * 20) * 0.4 + 0.6
      this.ctx.strokeStyle = `rgba(79, 195, 247, ${glowIntensity})`
      this.ctx.lineWidth = 1.5
      this.ctx.beginPath()
      this.ctx.arc(0, 0, size * 1.3, 0, Math.PI * 2)
      this.ctx.stroke()
    }

    this.ctx.restore()
  }

  private drawPowerUp(
    x: number,
    y: number,
    size: number,
    powerType: number
  ): void {
    this.ctx.save()
    this.ctx.translate(x, y)

    let color: string
    let symbol: string

    switch (powerType) {
      case 0: // Health
        color = "#4caf50"
        symbol = "♥"
        break
      case 1: // Weapon
        color = "#ffeb3b"
        symbol = "⚡"
        break
      case 2: // Shield
        color = "#2196f3"
        symbol = "🛡"
        break
      default:
        color = "#4caf50"
        symbol = "♥"
    }

    // Draw power-up background
    this.ctx.fillStyle = color
    this.ctx.beginPath()
    this.ctx.arc(0, 0, size, 0, Math.PI * 2)
    this.ctx.fill()

    // Draw symbol
    this.ctx.fillStyle = "white"
    this.ctx.font = `${size}px Arial`
    this.ctx.textAlign = "center"
    this.ctx.textBaseline = "middle"
    this.ctx.fillText(symbol, 0, 0)

    // Add glow effect
    this.ctx.shadowColor = color
    this.ctx.shadowBlur = 10
    this.ctx.beginPath()
    this.ctx.arc(0, 0, size, 0, Math.PI * 2)
    this.ctx.stroke()

    this.ctx.restore()
  }

  private drawExplosion(
    x: number,
    y: number,
    size: number,
    lifeRatio: number
  ): void {
    // Draw dramatic explosion effect
    this.ctx.save()
    this.ctx.translate(x, y)

    const time = Date.now() * 0.001

    // Explosion size based on life ratio (starts large, shrinks as it fades)
    const explosionSize = size * (1 + (1 - lifeRatio) * 2)
    const opacity = lifeRatio

    // Core explosion - bright center
    const coreGradient = this.ctx.createRadialGradient(
      0,
      0,
      0,
      0,
      0,
      explosionSize * 0.3
    )
    coreGradient.addColorStop(0, `rgba(255, 255, 255, ${opacity})`)
    coreGradient.addColorStop(0.3, `rgba(255, 255, 0, ${opacity * 0.8})`)
    coreGradient.addColorStop(0.6, `rgba(255, 165, 0, ${opacity * 0.6})`)
    coreGradient.addColorStop(1, `rgba(255, 0, 0, ${opacity * 0.4})`)

    this.ctx.fillStyle = coreGradient
    this.ctx.beginPath()
    this.ctx.arc(0, 0, explosionSize * 0.3, 0, Math.PI * 2)
    this.ctx.fill()

    // Outer explosion ring
    const ringGradient = this.ctx.createRadialGradient(
      0,
      0,
      explosionSize * 0.3,
      0,
      0,
      explosionSize
    )
    ringGradient.addColorStop(0, `rgba(255, 165, 0, ${opacity * 0.6})`)
    ringGradient.addColorStop(0.5, `rgba(255, 0, 0, ${opacity * 0.4})`)
    ringGradient.addColorStop(1, `rgba(255, 0, 0, 0)`)

    this.ctx.fillStyle = ringGradient
    this.ctx.beginPath()
    this.ctx.arc(0, 0, explosionSize, 0, Math.PI * 2)
    this.ctx.fill()

    // Explosion particles
    const particleCount = Math.floor(15 * lifeRatio)
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + time * 3
      const distance = explosionSize * (0.5 + Math.random() * 0.5)
      const particleX = Math.cos(angle) * distance
      const particleY = Math.sin(angle) * distance
      const particleSize = (2 + Math.random() * 3) * lifeRatio

      this.ctx.fillStyle = `rgba(255, ${Math.random() > 0.5 ? 165 : 255}, 0, ${
        opacity * 0.8
      })`
      this.ctx.beginPath()
      this.ctx.arc(particleX, particleY, particleSize, 0, Math.PI * 2)
      this.ctx.fill()
    }

    // Shockwave ring
    const shockwaveSize = explosionSize * (1.5 + (1 - lifeRatio) * 2)
    this.ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.3})`
    this.ctx.lineWidth = 3 * lifeRatio
    this.ctx.beginPath()
    this.ctx.arc(0, 0, shockwaveSize, 0, Math.PI * 2)
    this.ctx.stroke()

    // Secondary shockwave
    const secondarySize = explosionSize * (2 + (1 - lifeRatio) * 3)
    this.ctx.strokeStyle = `rgba(255, 165, 0, ${opacity * 0.2})`
    this.ctx.lineWidth = 2 * lifeRatio
    this.ctx.beginPath()
    this.ctx.arc(0, 0, secondarySize, 0, Math.PI * 2)
    this.ctx.stroke()

    this.ctx.restore()
  }

  private showGameOver(): void {
    const gameOverElement = document.getElementById("gameOver") as HTMLElement
    const finalScoreElement = document.getElementById(
      "finalScore"
    ) as HTMLElement

    if (this.gameEngine) {
      finalScoreElement.textContent = this.gameEngine.get_score().toString()
    }

    gameOverElement.style.display = "block"
  }

  public restart(): void {
    if (this.gameEngine) {
      this.gameEngine.reset()
    }

    const gameOverElement = document.getElementById("gameOver") as HTMLElement
    gameOverElement.style.display = "none"
  }

  public destroy(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId)
    }
  }
}

// Initialize the game
const game = new SpaceShooterGame()
;(window as any).gameInstance = game

// Global restart function for the HTML button
;(window as any).restartGame = () => {
  game.restart()
}
