import * as Phaser from 'phaser'
import { CameraController } from './cameraController'
import { RoadManager } from './roadManager'
import { GameGrid } from './gameGrid'
import { UIScene } from './uiScene'

type CursorMode = 'pan' | 'draw' | 'erase'

const gridCellSize: number = 32
const worldSize: number = 320

class MainScene extends Phaser.Scene {
  private gridCellSize: number = gridCellSize
  private worldSize: number = worldSize
  private grid: GameGrid
  private graphics: Phaser.GameObjects.Graphics
  private cameraController: CameraController
  private roadManager: RoadManager

  constructor() {
    super({ key: 'MainScene' })
  }

  preload(): void {
    // Load your assets here
    this.load.image('roads', 'assets/images/tiles/roads.png')
  }

  create(): void {
    this.cameras.main.setBounds(
      0,
      0,
      this.worldSize * this.gridCellSize,
      this.worldSize * this.gridCellSize,
    )

    this.physics.world.setBounds(
      0,
      0,
      this.worldSize * this.gridCellSize,
      this.worldSize * this.gridCellSize,
    )

    this.grid = new GameGrid(
      this,
      this.gridCellSize,
      this.worldSize,
      this.worldSize,
    )
    this.grid.drawGrid()

    this.cameraController = new CameraController(this)

    // Interactive road drawing
    this.roadManager = new RoadManager(this.grid)
  }

  update(): void {
    this.cameraController.update()
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  physics: {
    default: 'arcade',
    arcade: {
      debug: true,
      gravity: { y: 0 },
      width: 2000,
      height: 2000,
    },
  },
  width: 2000,
  height: 2000,
  scene: [MainScene],
  backgroundColor: '#F8F6EB',
  // Additional configuration options
}

const game = new Phaser.Game(config)
