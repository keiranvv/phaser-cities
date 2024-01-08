import * as Phaser from 'phaser'
import { CameraController } from './cameraController'
import { RoadCell, RoadManager } from './roadManager'
import { GameGrid } from './gameGrid'
import { UIScene } from './uiScene'
import { ZoneManager } from './zoneManager'

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
  private zoneManager: ZoneManager
  private roadCells: RoadCell[] = []

  constructor() {
    super({ key: 'MainScene' })
  }

  setupToolbar() {
    document.getElementById('road').addEventListener('click', (e) => {
      e.stopPropagation()
      this.zoneManager.setZoneType('none')
      this.roadManager.toggle()
    })

    document.getElementById('residential').addEventListener('click', (e) => {
      e.stopPropagation()

      this.roadManager.disable()
      if (this.zoneManager.getZoneType() === 'residential') {
        this.zoneManager.setZoneType('none')
      } else {
        this.zoneManager.setZoneType('residential')
      }
    })

    document.getElementById('commercial').addEventListener('click', (e) => {
      e.stopPropagation()

      this.roadManager.disable()
      if (this.zoneManager.getZoneType() === 'commercial') {
        this.zoneManager.setZoneType('none')
      } else {
        this.zoneManager.setZoneType('commercial')
      }
    })

    document.getElementById('industrial').addEventListener('click', (e) => {
      e.stopPropagation()

      this.roadManager.disable()
      if (this.zoneManager.getZoneType() === 'industrial') {
        this.zoneManager.setZoneType('none')
      } else {
        this.zoneManager.setZoneType('industrial')
      }
    })
  }

  preload(): void {
    // Load your assets here
    this.load.image('roads', 'assets/images/tiles/roads.png')
    this.load.image('zones', 'assets/images/tiles/zones.png')
  }

  create(): void {
    this.setupToolbar()
    this.cameras.main.setBounds(
      0,
      0,
      this.worldSize * this.gridCellSize,
      this.worldSize * this.gridCellSize
    )

    this.physics.world.setBounds(
      0,
      0,
      this.worldSize * this.gridCellSize,
      this.worldSize * this.gridCellSize
    )

    this.grid = new GameGrid(
      this,
      this.gridCellSize,
      this.worldSize,
      this.worldSize
    )
    this.input.mouse.disableContextMenu()

    this.grid.drawGrid()

    this.cameraController = new CameraController(this)
    this.zoneManager = new ZoneManager([], this.grid)
    this.roadManager = new RoadManager(this.grid)

    this.roadManager.on('roadTilesChanged', (cells: RoadCell[]) => {
      this.roadCells = cells
      this.zoneManager.updateRoadCells(cells)
    })
  }

  update(): void {
    this.cameraController.update()
  }
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  parent: 'game',
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

new Phaser.Game(config)
