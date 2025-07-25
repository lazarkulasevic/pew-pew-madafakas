export class SoundManager {
  private audioContext: AudioContext | null = null
  private isEnabled: boolean = true
  private gainNode: GainNode | null = null
  private lastLaserTime: number = 0
  private laserCooldown: number = 0.08 // 80ms between laser sounds

  constructor() {
    this.initAudio()
  }

  private initAudio(): void {
    try {
      this.audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)()
      this.gainNode = this.audioContext.createGain()
      this.gainNode.connect(this.audioContext.destination)
      this.gainNode.gain.value = 0.3 // Master volume
    } catch (error) {
      console.warn("Web Audio API not supported:", error)
    }
  }

  public toggleSound(): void {
    this.isEnabled = !this.isEnabled
    if (this.gainNode) {
      this.gainNode.gain.value = this.isEnabled ? 0.3 : 0
    }
    this.updateSoundButton()
  }

  private updateSoundButton(): void {
    const soundButton = document.getElementById("soundToggle")
    if (soundButton) {
      soundButton.textContent = this.isEnabled ? "🔊 Sound ON" : "🔇 Sound OFF"
      soundButton.style.background = this.isEnabled ? "#4fc3f7" : "#666"
    }
  }

  public playLaserSound(): void {
    if (!this.isEnabled || !this.audioContext) return

    const currentTime = this.audioContext.currentTime

    // Check cooldown - only play sound if enough time has passed
    if (currentTime - this.lastLaserTime < this.laserCooldown) {
      return
    }

    this.lastLaserTime = currentTime

    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    const filter = this.audioContext.createBiquadFilter()

    // Connect nodes
    oscillator.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(this.gainNode!)

    // Classic "pew pew" meme sound - more percussive
    oscillator.type = "square"
    oscillator.frequency.setValueAtTime(800, currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(400, currentTime + 0.03)

    // Sharp attack, quick decay for "pew" sound
    gainNode.gain.setValueAtTime(0, currentTime)
    gainNode.gain.linearRampToValueAtTime(0.12, currentTime + 0.001)
    gainNode.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.03)

    // Band-pass filter for that classic "pew" character
    filter.type = "bandpass"
    filter.frequency.setValueAtTime(600, currentTime)
    filter.Q.setValueAtTime(8, currentTime)

    oscillator.start(currentTime)
    oscillator.stop(currentTime + 0.03)
  }

  public playExplosionSound(type: "tank" | "blackhole"): void {
    if (!this.isEnabled || !this.audioContext) return

    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    const filter = this.audioContext.createBiquadFilter()

    // Connect nodes
    oscillator.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(this.gainNode!)

    // Explosion sound settings
    oscillator.type = "sawtooth"

    if (type === "tank") {
      // Tank explosion - shorter, higher pitch
      oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(
        50,
        this.audioContext.currentTime + 0.3
      )

      gainNode.gain.setValueAtTime(0.15, this.audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + 0.3
      )

      filter.frequency.setValueAtTime(2000, this.audioContext.currentTime)
      filter.frequency.exponentialRampToValueAtTime(
        200,
        this.audioContext.currentTime + 0.3
      )

      oscillator.start(this.audioContext.currentTime)
      oscillator.stop(this.audioContext.currentTime + 0.3)
    } else {
      // Black hole explosion - longer, deeper, more dramatic
      oscillator.frequency.setValueAtTime(150, this.audioContext.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(
        20,
        this.audioContext.currentTime + 0.8
      )

      gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        this.audioContext.currentTime + 0.8
      )

      filter.frequency.setValueAtTime(1000, this.audioContext.currentTime)
      filter.frequency.exponentialRampToValueAtTime(
        100,
        this.audioContext.currentTime + 0.8
      )

      oscillator.start(this.audioContext.currentTime)
      oscillator.stop(this.audioContext.currentTime + 0.8)
    }
  }

  public playBlackHoleActivation(): void {
    if (!this.isEnabled || !this.audioContext) return

    const oscillator = this.audioContext.createOscillator()
    const gainNode = this.audioContext.createGain()
    const filter = this.audioContext.createBiquadFilter()

    // Connect nodes
    oscillator.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(this.gainNode!)

    // Black hole activation sound - mysterious, deep
    oscillator.type = "sine"
    oscillator.frequency.setValueAtTime(80, this.audioContext.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(
      40,
      this.audioContext.currentTime + 0.5
    )

    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime)
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      this.audioContext.currentTime + 0.5
    )

    filter.frequency.setValueAtTime(500, this.audioContext.currentTime)
    filter.frequency.exponentialRampToValueAtTime(
      200,
      this.audioContext.currentTime + 0.5
    )

    oscillator.start(this.audioContext.currentTime)
    oscillator.stop(this.audioContext.currentTime + 0.5)
  }

  public resumeAudio(): void {
    if (this.audioContext && this.audioContext.state === "suspended") {
      this.audioContext.resume()
    }
  }
}
