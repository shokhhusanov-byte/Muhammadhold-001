/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Point {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
  rotation: number;
  type: 'good' | 'enemy' | 'player';
  health: number;
  lastShot: number;
  targetRotation: number;
}

export interface Bullet {
  id: string;
  x: number;
  y: number;
  dx: number;
  dy: number;
  ownerType: 'good' | 'enemy' | 'player';
}

export interface Obstacle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const GAME_WIDTH = 1000;
export const GAME_HEIGHT = 800;
export const TANK_SIZE = 40;
export const TANK_SPEED = 2;
export const BULLET_SPEED = 6;
export const FIRE_RATE = 1000; // ms
