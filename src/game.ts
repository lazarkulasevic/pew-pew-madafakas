import init, { GameEngine } from "./wasm/particle_system.js"

class SpaceShooterGame {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private gameEngine: GameEngine | null = null
  private animationId: number | null = null
  private lastTime: number = 0
  private keys: Set<string> = new Set()
  private isShooting: boolean = false

  constructor() {
    this.canvas = document.getElementById("canvas") as HTMLCanvasElement
    this.ctx = this.canvas.getContext("2d")!
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

    this.gameEngine.move_player(dx, dy)

    if (this.isShooting) {
      this.gameEngine.shoot()
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
      if (gameData.length < 5) {
        console.error("Game data too short:", gameData.length)
        return
      }

      // Parse metadata: [player_count, enemy_count, player_bullet_count, enemy_bullet_count, power_up_count]
      const playerCount = Math.floor(gameData[dataIndex++])
      const enemyCount = Math.floor(gameData[dataIndex++])
      const playerBulletCount = Math.floor(gameData[dataIndex++])
      const enemyBulletCount = Math.floor(gameData[dataIndex++])
      const powerUpCount = Math.floor(gameData[dataIndex++])

      // Safety check for reasonable counts
      if (
        enemyCount > 100 ||
        playerBulletCount > 100 ||
        enemyBulletCount > 100 ||
        powerUpCount > 50
      ) {
        console.error("Unreasonable object counts:", {
          enemyCount,
          playerBulletCount,
          enemyBulletCount,
          powerUpCount,
        })
        return
      }

      // Draw player (5 values: x, y, size, health, power_level)
      if (dataIndex + 4 < gameData.length) {
        const playerX = gameData[dataIndex++]
        const playerY = gameData[dataIndex++]
        const playerSize = gameData[dataIndex++]
        const playerHealth = gameData[dataIndex++]
        const playerPowerLevel = gameData[dataIndex++]

        // Safety check for player position
        if (playerX >= 0 && playerY >= 0 && playerSize > 0) {
          this.drawPlayer(
            playerX,
            playerY,
            playerSize,
            playerHealth,
            playerPowerLevel
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

    // Draw occasional shooting stars
    this.drawShootingStars()

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

  private drawShootingStars(): void {
    // Only show shooting stars occasionally
    if (Math.random() < 0.02) {
      const x = Math.random() * this.canvas.width
      const y = -20
      const length = 100 + Math.random() * 50
      const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.5

      // Create gradient for shooting star
      const gradient = this.ctx.createLinearGradient(
        x,
        y,
        x + Math.cos(angle) * length,
        y + Math.sin(angle) * length
      )
      gradient.addColorStop(0, "rgba(255, 255, 255, 0.8)")
      gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.4)")
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)")

      this.ctx.strokeStyle = gradient
      this.ctx.lineWidth = 2
      this.ctx.beginPath()
      this.ctx.moveTo(x, y)
      this.ctx.lineTo(
        x + Math.cos(angle) * length,
        y + Math.sin(angle) * length
      )
      this.ctx.stroke()
    }
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
    powerLevel: number
  ): void {
    // Draw player ship
    this.ctx.save()
    this.ctx.translate(x, y)

    // Ship body
    this.ctx.fillStyle = "#4fc3f7"
    this.ctx.beginPath()
    this.ctx.moveTo(0, -size)
    this.ctx.lineTo(-size * 0.7, size * 0.5)
    this.ctx.lineTo(-size * 0.3, size * 0.3)
    this.ctx.lineTo(size * 0.3, size * 0.3)
    this.ctx.lineTo(size * 0.7, size * 0.5)
    this.ctx.closePath()
    this.ctx.fill()

    // Ship details
    this.ctx.fillStyle = "#29b6f6"
    this.ctx.beginPath()
    this.ctx.moveTo(0, -size * 0.8)
    this.ctx.lineTo(-size * 0.4, size * 0.2)
    this.ctx.lineTo(size * 0.4, size * 0.2)
    this.ctx.closePath()
    this.ctx.fill()

    // Engine glow
    this.ctx.fillStyle = "#ff9800"
    this.ctx.beginPath()
    this.ctx.arc(0, size * 0.3, size * 0.2, 0, Math.PI * 2)
    this.ctx.fill()

    this.ctx.restore()

    // Draw power level indicator
    if (powerLevel > 1) {
      this.ctx.fillStyle = "#ffeb3b"
      this.ctx.font = "12px Arial"
      this.ctx.textAlign = "center"
      this.ctx.fillText(`P${powerLevel}`, x, y - size - 10)
    }
  }

  private drawEnemy(
    x: number,
    y: number,
    size: number,
    health: number,
    enemyType: number
  ): void {
    this.ctx.save()
    this.ctx.translate(x, y)

    let color: string
    let shape: string

    switch (enemyType) {
      case 0: // Basic
        color = "#f44336"
        shape = "circle"
        break
      case 1: // Fast
        color = "#ff9800"
        shape = "triangle"
        break
      case 2: // Tank
        color = "#9c27b0"
        shape = "square"
        break
      default:
        color = "#f44336"
        shape = "circle"
    }

    this.ctx.fillStyle = color

    switch (shape) {
      case "circle":
        this.ctx.beginPath()
        this.ctx.arc(0, 0, size, 0, Math.PI * 2)
        this.ctx.fill()
        break
      case "triangle":
        this.ctx.beginPath()
        this.ctx.moveTo(0, size)
        this.ctx.lineTo(-size, -size)
        this.ctx.lineTo(size, -size)
        this.ctx.closePath()
        this.ctx.fill()
        break
      case "square":
        this.ctx.fillRect(-size, -size, size * 2, size * 2)
        break
    }

    this.ctx.restore()

    // Draw health bar for tank enemies
    if (enemyType === 2) {
      const healthPercent = health / 50.0
      const barWidth = size * 2
      const barHeight = 4

      this.ctx.fillStyle = "rgba(255, 0, 0, 0.5)"
      this.ctx.fillRect(x - barWidth / 2, y - size - 10, barWidth, barHeight)

      this.ctx.fillStyle = "#ff4444"
      this.ctx.fillRect(
        x - barWidth / 2,
        y - size - 10,
        barWidth * healthPercent,
        barHeight
      )
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

    if (isEnemy) {
      // Enemy bullet
      this.ctx.fillStyle = "#ff4444"
      this.ctx.beginPath()
      this.ctx.arc(0, 0, size, 0, Math.PI * 2)
      this.ctx.fill()
    } else {
      // Player bullet
      this.ctx.fillStyle = "#4fc3f7"
      this.ctx.beginPath()
      this.ctx.arc(0, 0, size, 0, Math.PI * 2)
      this.ctx.fill()

      // Bullet trail
      this.ctx.fillStyle = "rgba(79, 195, 247, 0.5)"
      this.ctx.beginPath()
      this.ctx.arc(0, size * 2, size * 0.5, 0, Math.PI * 2)
      this.ctx.fill()
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

// Global restart function for the HTML button
;(window as any).restartGame = () => {
  game.restart()
}
