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

    // Handle input
    let dx = 0
    let dy = 0

    if (this.keys.has("arrowleft") || this.keys.has("a")) dx -= 1
    if (this.keys.has("arrowright") || this.keys.has("d")) dx += 1
    if (this.keys.has("arrowup") || this.keys.has("w")) dy -= 1
    if (this.keys.has("arrowdown") || this.keys.has("s")) dy += 1

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
      dx *= 0.707 // 1/√2
      dy *= 0.707
    }

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

    // Get game data from WebAssembly
    const gameData = this.gameEngine.get_game_data()
    let dataIndex = 0

    // Parse metadata: [player_count, enemy_count, player_bullet_count, enemy_bullet_count, power_up_count]
    if (dataIndex + 4 >= gameData.length) return

    const playerCount = Math.floor(gameData[dataIndex++])
    const enemyCount = Math.floor(gameData[dataIndex++])
    const playerBulletCount = Math.floor(gameData[dataIndex++])
    const enemyBulletCount = Math.floor(gameData[dataIndex++])
    const powerUpCount = Math.floor(gameData[dataIndex++])

    // Draw player (5 values: x, y, size, health, power_level)
    if (dataIndex + 4 < gameData.length) {
      const playerX = gameData[dataIndex++]
      const playerY = gameData[dataIndex++]
      const playerSize = gameData[dataIndex++]
      const playerHealth = gameData[dataIndex++]
      const playerPowerLevel = gameData[dataIndex++]

      this.drawPlayer(
        playerX,
        playerY,
        playerSize,
        playerHealth,
        playerPowerLevel
      )
    }

    // Draw enemies (5 values each: x, y, size, health, type)
    for (let i = 0; i < enemyCount && dataIndex + 4 < gameData.length; i++) {
      const x = gameData[dataIndex++]
      const y = gameData[dataIndex++]
      const size = gameData[dataIndex++]
      const health = gameData[dataIndex++]
      const enemyType = gameData[dataIndex++]
      this.drawEnemy(x, y, size, health, enemyType)
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
      this.drawBullet(x, y, size, isEnemy === 1.0)
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
      this.drawBullet(x, y, size, isEnemy === 1.0)
    }

    // Draw power-ups (4 values each: x, y, size, type)
    for (let i = 0; i < powerUpCount && dataIndex + 3 < gameData.length; i++) {
      const x = gameData[dataIndex++]
      const y = gameData[dataIndex++]
      const size = gameData[dataIndex++]
      const powerType = gameData[dataIndex++]
      this.drawPowerUp(x, y, size, powerType)
    }
  }

  private drawStarfield(): void {
    // Create a simple animated starfield
    const time = Date.now() * 0.001
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)"

    for (let i = 0; i < 100; i++) {
      const x = (i * 37) % this.canvas.width
      const y = (i * 73 + time * 50) % this.canvas.height
      const size = (i % 3) + 1

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
