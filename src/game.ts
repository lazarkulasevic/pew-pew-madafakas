import init, { GameEngine } from "./wasm/particle_system.js"

class SpaceShooterGame {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private gameEngine: GameEngine | null = null
  private animationId: number | null = null
  private lastTime: number = 0
  private keys: Set<string> = new Set()
  private isShooting: boolean = false
  private isMovingForward: boolean = false

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

    // Store movement state for warp core effect
    this.isMovingForward = dy < 0

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
      if (gameData.length < 6) {
        console.error("Game data too short:", gameData.length)
        return
      }

      // Parse metadata: [player_count, enemy_count, player_bullet_count, enemy_bullet_count, power_up_count, explosion_count]
      const playerCount = Math.floor(gameData[dataIndex++])
      const enemyCount = Math.floor(gameData[dataIndex++])
      const playerBulletCount = Math.floor(gameData[dataIndex++])
      const enemyBulletCount = Math.floor(gameData[dataIndex++])
      const powerUpCount = Math.floor(gameData[dataIndex++])
      const explosionCount = Math.floor(gameData[dataIndex++])

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
    powerLevel: number
  ): void {
    // Draw realistic player spaceship
    this.ctx.save()
    this.ctx.translate(x, y)

    const time = Date.now() * 0.001

    // Main hull - sleek fighter design
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

    // Shield effect (if health is low)
    if (health < 30) {
      this.ctx.strokeStyle = `rgba(255, 193, 7, ${
        0.5 + Math.sin(time * 5) * 0.3
      })`
      this.ctx.lineWidth = 2
      this.ctx.beginPath()
      this.ctx.ellipse(0, 0, size * 1.2, size * 1.2, 0, 0, Math.PI * 2)
      this.ctx.stroke()
    }

    // Warp core effect when moving forward
    if (this.isMovingForward) {
      this.drawWarpCoreEffect(size, time)
    }

    this.ctx.restore()

    // Draw power level indicator
    if (powerLevel > 1) {
      this.ctx.fillStyle = "#ffeb3b"
      this.ctx.font = "bold 12px Arial"
      this.ctx.textAlign = "center"
      this.ctx.fillText(`P${powerLevel}`, x, y - size - 15)
    }
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

// Global restart function for the HTML button
;(window as any).restartGame = () => {
  game.restart()
}
