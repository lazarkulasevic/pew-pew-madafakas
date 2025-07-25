use wasm_bindgen::prelude::*;
use js_sys::Float32Array;

#[wasm_bindgen]
pub struct GameEngine {
    player: Player,
    enemies: Vec<Enemy>,
    bullets: Vec<Bullet>,
    enemy_bullets: Vec<Bullet>,
    power_ups: Vec<PowerUp>,
    explosions: Vec<Explosion>,
    score: u32,
    level: u32,
    game_time: f32,
    enemy_spawn_timer: f32,
    power_up_spawn_timer: f32,
    width: f32,
    height: f32,
    game_over: bool,
}

#[derive(Clone)]
struct Player {
    x: f32,
    y: f32,
    vx: f32,
    vy: f32,
    health: f32,
    max_health: f32,
    size: f32,
    shoot_cooldown: f32,
    power_level: u32,
}

#[derive(Clone)]
struct Enemy {
    x: f32,
    y: f32,
    vx: f32,
    vy: f32,
    health: f32,
    size: f32,
    enemy_type: EnemyType,
    shoot_cooldown: f32,
}

#[derive(Clone)]
#[derive(PartialEq)]
enum EnemyType {
    Basic,
    Fast,
    Tank,
}

#[derive(Clone)]
struct Bullet {
    x: f32,
    y: f32,
    vx: f32,
    vy: f32,
    size: f32,
    damage: f32,
}

#[derive(Clone)]
struct PowerUp {
    x: f32,
    y: f32,
    vy: f32,
    size: f32,
    power_type: PowerUpType,
}

#[derive(Clone)]
enum PowerUpType {
    Health,
    Weapon,
    Shield,
}

struct Explosion {
    x: f32,
    y: f32,
    size: f32,
    life: f32,
    max_life: f32,
}

#[wasm_bindgen]
impl GameEngine {
    pub fn new(width: f32, height: f32) -> GameEngine {
        let player = Player {
            x: width / 2.0,
            y: height - 100.0,
            vx: 0.0,
            vy: 0.0,
            health: 100.0,
            max_health: 100.0,
            size: 20.0,
            shoot_cooldown: 0.0,
            power_level: 1,
        };

        GameEngine {
            player,
            enemies: Vec::new(),
            bullets: Vec::new(),
            enemy_bullets: Vec::new(),
            power_ups: Vec::new(),
            explosions: Vec::new(),
            score: 0,
            level: 1,
            game_time: 0.0,
            enemy_spawn_timer: 0.0,
            power_up_spawn_timer: 0.0,
            width,
            height,
            game_over: false,
        }
    }

    pub fn update(&mut self, delta_time: f32) {
        if self.game_over {
            return;
        }

        self.game_time += delta_time;
        self.enemy_spawn_timer += delta_time;
        self.power_up_spawn_timer += delta_time;

        // Update player
        self.update_player(delta_time);

        // Spawn enemies
        if self.enemy_spawn_timer >= 1.0 / (1.0 + self.level as f32 * 0.2) {
            self.spawn_enemy();
            self.enemy_spawn_timer = 0.0;
        }

        // Spawn power-ups
        if self.power_up_spawn_timer >= 5.0 {
            self.spawn_power_up();
            self.power_up_spawn_timer = 0.0;
        }

        // Update enemies
        self.update_enemies(delta_time);

        // Update bullets
        self.update_bullets(delta_time);

        // Update power-ups
        self.update_power_ups(delta_time);

        // Update explosions
        self.update_explosions(delta_time);

        // Check collisions
        self.check_collisions();

        // Clean up off-screen objects
        self.cleanup();

        // Level up
        if self.score >= self.level * 1000 {
            self.level += 1;
        }
    }

    fn update_player(&mut self, delta_time: f32) {
        // Update position
        self.player.x += self.player.vx * delta_time * 200.0;
        self.player.y += self.player.vy * delta_time * 200.0;

        // Keep player in bounds
        self.player.x = self.player.x.clamp(self.player.size, self.width - self.player.size);
        self.player.y = self.player.y.clamp(self.player.size, self.height - self.player.size);

        // Update shoot cooldown
        if self.player.shoot_cooldown > 0.0 {
            self.player.shoot_cooldown -= delta_time;
        }
    }

    fn spawn_enemy(&mut self) {
        let enemy_type = if js_sys::Math::random() < 0.1 {
            EnemyType::Tank
        } else if js_sys::Math::random() < 0.3 {
            EnemyType::Fast
        } else {
            EnemyType::Basic
        };

        let (size, health, speed) = match enemy_type {
            EnemyType::Basic => (15.0, 20.0, 50.0),
            EnemyType::Fast => (12.0, 15.0, 100.0),
            EnemyType::Tank => (25.0, 50.0, 30.0),
        };

        let enemy = Enemy {
            x: (js_sys::Math::random() as f32) * (self.width - 50.0) + 25.0,
            y: -50.0,
            vx: (js_sys::Math::random() as f32 - 0.5) * speed,
            vy: speed,
            health,
            size,
            enemy_type,
            shoot_cooldown: 0.0,
        };

        self.enemies.push(enemy);
    }

    fn spawn_power_up(&mut self) {
        let power_type = if js_sys::Math::random() < 0.4 {
            PowerUpType::Health
        } else if js_sys::Math::random() < 0.7 {
            PowerUpType::Weapon
        } else {
            PowerUpType::Shield
        };

        let power_up = PowerUp {
            x: (js_sys::Math::random() as f32) * (self.width - 30.0) + 15.0,
            y: -30.0,
            vy: 80.0,
            size: 15.0,
            power_type,
        };

        self.power_ups.push(power_up);
    }

    fn update_enemies(&mut self, delta_time: f32) {
        for enemy in &mut self.enemies {
            enemy.x += enemy.vx * delta_time;
            enemy.y += enemy.vy * delta_time;

            // Enemy shooting
            if enemy.shoot_cooldown > 0.0 {
                enemy.shoot_cooldown -= delta_time;
            } else if js_sys::Math::random() < 0.01 {
                self.enemy_bullets.push(Bullet {
                    x: enemy.x,
                    y: enemy.y + enemy.size,
                    vx: 0.0,
                    vy: 150.0,
                    size: 5.0,
                    damage: 10.0,
                });
                enemy.shoot_cooldown = 2.0;
            }
        }
    }

    fn update_bullets(&mut self, delta_time: f32) {
        for bullet in &mut self.bullets {
            bullet.x += bullet.vx * delta_time;
            bullet.y += bullet.vy * delta_time;
        }

        for bullet in &mut self.enemy_bullets {
            bullet.x += bullet.vx * delta_time;
            bullet.y += bullet.vy * delta_time;
        }
    }

    fn update_power_ups(&mut self, delta_time: f32) {
        for power_up in &mut self.power_ups {
            power_up.y += power_up.vy * delta_time;
        }
    }

    fn update_explosions(&mut self, delta_time: f32) {
        for explosion in &mut self.explosions {
            explosion.life -= delta_time;
        }
    }

    fn check_collisions(&mut self) {
        // Player bullets vs enemies
        let mut bullets_to_remove = Vec::new();
        let mut enemies_to_remove = Vec::new();

        for (bullet_idx, bullet) in self.bullets.iter().enumerate() {
            for (enemy_idx, enemy) in self.enemies.iter_mut().enumerate() {
                let dx = bullet.x - enemy.x;
                let dy = bullet.y - enemy.y;
                let distance = (dx * dx + dy * dy).sqrt();

                if distance < bullet.size + enemy.size {
                    bullets_to_remove.push(bullet_idx);
                    enemy.health -= bullet.damage;
                    if enemy.health <= 0.0 {
                        enemies_to_remove.push(enemy_idx);
                        self.score += match enemy.enemy_type {
                            EnemyType::Basic => 100,
                            EnemyType::Fast => 150,
                            EnemyType::Tank => 300,
                        };

                        // Create explosion for tank enemies
                        if enemy.enemy_type == EnemyType::Tank {
                            self.explosions.push(Explosion {
                                x: enemy.x,
                                y: enemy.y,
                                size: enemy.size * 2.0,
                                life: 1.0,
                                max_life: 1.0,
                            });
                        }
                    }
                    break;
                }
            }
        }

        // Enemy bullets vs player
        for bullet in &self.enemy_bullets {
            let dx = bullet.x - self.player.x;
            let dy = bullet.y - self.player.y;
            let distance = (dx * dx + dy * dy).sqrt();

            if distance < bullet.size + self.player.size {
                self.player.health -= bullet.damage;
                if self.player.health <= 0.0 {
                    self.game_over = true;
                }
            }
        }

        // Enemies vs player
        for enemy in &self.enemies {
            let dx = enemy.x - self.player.x;
            let dy = enemy.y - self.player.y;
            let distance = (dx * dx + dy * dy).sqrt();

            if distance < enemy.size + self.player.size {
                self.player.health -= 20.0;
                if self.player.health <= 0.0 {
                    self.game_over = true;
                }
            }
        }

        // Power-ups vs player
        let mut power_ups_to_remove = Vec::new();
        for (power_up_idx, power_up) in self.power_ups.iter().enumerate() {
            let dx = power_up.x - self.player.x;
            let dy = power_up.y - self.player.y;
            let distance = (dx * dx + dy * dy).sqrt();

            if distance < power_up.size + self.player.size {
                match power_up.power_type {
                    PowerUpType::Health => {
                        self.player.health = (self.player.health + 30.0).min(self.player.max_health);
                    }
                    PowerUpType::Weapon => {
                        self.player.power_level = (self.player.power_level + 1).min(3);
                    }
                    PowerUpType::Shield => {
                        self.player.health = (self.player.health + 50.0).min(self.player.max_health);
                    }
                }
                power_ups_to_remove.push(power_up_idx);
            }
        }

        // Remove collided objects
        for &idx in bullets_to_remove.iter().rev() {
            self.bullets.remove(idx);
        }
        for &idx in enemies_to_remove.iter().rev() {
            self.enemies.remove(idx);
        }
        for &idx in power_ups_to_remove.iter().rev() {
            self.power_ups.remove(idx);
        }
    }

    fn cleanup(&mut self) {
        // Remove off-screen bullets
        self.bullets.retain(|bullet| bullet.y > -50.0 && bullet.y < self.height + 50.0);
        self.enemy_bullets.retain(|bullet| bullet.y > -50.0 && bullet.y < self.height + 50.0);

        // Remove off-screen enemies
        self.enemies.retain(|enemy| enemy.y < self.height + 100.0);

        // Remove off-screen power-ups
        self.power_ups.retain(|power_up| power_up.y < self.height + 50.0);

        // Remove dead explosions
        self.explosions.retain(|explosion| explosion.life > 0.0);
    }

    pub fn move_player(&mut self, dx: f32, dy: f32) {
        self.player.vx = dx;
        self.player.vy = dy;
    }

    pub fn shoot(&mut self) {
        if self.player.shoot_cooldown <= 0.0 {
            let bullet_speed = 300.0;
            let bullet_size = 8.0;
            let bullet_damage = 25.0 * self.player.power_level as f32;

            match self.player.power_level {
                1 => {
                    self.bullets.push(Bullet {
                        x: self.player.x,
                        y: self.player.y - self.player.size,
                        vx: 0.0,
                        vy: -bullet_speed,
                        size: bullet_size,
                        damage: bullet_damage,
                    });
                }
                2 => {
                    self.bullets.push(Bullet {
                        x: self.player.x - 10.0,
                        y: self.player.y - self.player.size,
                        vx: 0.0,
                        vy: -bullet_speed,
                        size: bullet_size,
                        damage: bullet_damage,
                    });
                    self.bullets.push(Bullet {
                        x: self.player.x + 10.0,
                        y: self.player.y - self.player.size,
                        vx: 0.0,
                        vy: -bullet_speed,
                        size: bullet_size,
                        damage: bullet_damage,
                    });
                }
                3 => {
                    for i in -1..=1 {
                        self.bullets.push(Bullet {
                            x: self.player.x + i as f32 * 15.0,
                            y: self.player.y - self.player.size,
                            vx: i as f32 * 50.0,
                            vy: -bullet_speed,
                            size: bullet_size,
                            damage: bullet_damage,
                        });
                    }
                }
                _ => {}
            }

            self.player.shoot_cooldown = 0.2;
        }
    }

    pub fn get_game_data(&self) -> Float32Array {
        let mut data = Vec::new();

        // Add metadata: [player_count, enemy_count, player_bullet_count, enemy_bullet_count, power_up_count, explosion_count]
        data.push(1.0); // player_count
        data.push(self.enemies.len() as f32);
        data.push(self.bullets.len() as f32);
        data.push(self.enemy_bullets.len() as f32);
        data.push(self.power_ups.len() as f32);
        data.push(self.explosions.len() as f32);

        // Player data (x, y, size, health, power_level)
        data.push(self.player.x);
        data.push(self.player.y);
        data.push(self.player.size);
        data.push(self.player.health);
        data.push(self.player.power_level as f32);

        // Enemies data (x, y, size, health, type)
        for enemy in &self.enemies {
            data.push(enemy.x);
            data.push(enemy.y);
            data.push(enemy.size);
            data.push(enemy.health);
            data.push(match enemy.enemy_type {
                EnemyType::Basic => 0.0,
                EnemyType::Fast => 1.0,
                EnemyType::Tank => 2.0,
            });
        }

        // Player bullets data (x, y, size, is_enemy)
        for bullet in &self.bullets {
            data.push(bullet.x);
            data.push(bullet.y);
            data.push(bullet.size);
            data.push(0.0); // Player bullet
        }

        // Enemy bullets data (x, y, size, is_enemy)
        for bullet in &self.enemy_bullets {
            data.push(bullet.x);
            data.push(bullet.y);
            data.push(bullet.size);
            data.push(1.0); // Enemy bullet
        }

        // Power-ups data (x, y, size, type)
        for power_up in &self.power_ups {
            data.push(power_up.x);
            data.push(power_up.y);
            data.push(power_up.size);
            data.push(match power_up.power_type {
                PowerUpType::Health => 0.0,
                PowerUpType::Weapon => 1.0,
                PowerUpType::Shield => 2.0,
            });
        }

        // Explosions data (x, y, size, life_ratio)
        for explosion in &self.explosions {
            data.push(explosion.x);
            data.push(explosion.y);
            data.push(explosion.size);
            data.push(explosion.life / explosion.max_life);
        }

        unsafe { Float32Array::view(&data) }
    }

    pub fn get_score(&self) -> u32 {
        self.score
    }

    pub fn get_level(&self) -> u32 {
        self.level
    }

    pub fn get_health(&self) -> f32 {
        self.player.health
    }

    pub fn is_game_over(&self) -> bool {
        self.game_over
    }

    pub fn reset(&mut self) {
        self.player = Player {
            x: self.width / 2.0,
            y: self.height - 100.0,
            vx: 0.0,
            vy: 0.0,
            health: 100.0,
            max_health: 100.0,
            size: 20.0,
            shoot_cooldown: 0.0,
            power_level: 1,
        };
        self.enemies.clear();
        self.bullets.clear();
        self.enemy_bullets.clear();
        self.power_ups.clear();
        self.score = 0;
        self.level = 1;
        self.game_time = 0.0;
        self.enemy_spawn_timer = 0.0;
        self.power_up_spawn_timer = 0.0;
        self.game_over = false;
    }
}