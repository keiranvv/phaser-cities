import * as Phaser from 'phaser'
import Alpine from 'alpinejs'
import { CameraController } from './cameraController'
import { RoadCell, RoadManager } from './roadManager'
import { GameGrid } from './gameGrid'
import { ZoneManager, ZoneType } from './zoneManager'
import { BuildingSpawner } from './buildingSpawner'
import { DemandManager } from './gameState/demandManager'

declare global {
  interface Window {
    Alpine: any
  }
}

const gridCellSize: number = 32
const worldSize: number = 320

type ToolType =
  | 'road'
  | 'residential'
  | 'commercial'
  | 'industrial'
  | 'dezone'
  | 'bulldoze'

const updateUIData = (data: any) => {
  window.dispatchEvent(new CustomEvent('update', { detail: data }))
  console.log(data)
}

class MainScene extends Phaser.Scene {
  private gridCellSize: number = gridCellSize
  private worldSize: number = worldSize
  private grid: GameGrid
  private cameraController: CameraController
  private roadManager: RoadManager
  private zoneManager: ZoneManager
  private buildingSpawner: BuildingSpawner
  private demandManager: DemandManager

  constructor() {
    super({ key: 'MainScene' })

    Alpine.start()
    window.Alpine = Alpine
  }

  setupToolbar() {
    const toolButtons: { [key: string]: ToolType } = {
      road: 'road',
      residential: 'residential',
      commercial: 'commercial',
      industrial: 'industrial',
      dezone: 'dezone',
      bulldoze: 'bulldoze',
    }

    for (const [id, toolType] of Object.entries(toolButtons)) {
      document.getElementById(id).addEventListener('click', (e) => {
        e.stopPropagation()
        if ((e.target as HTMLElement).classList.contains('active')) {
          ;(e.target as HTMLElement).classList.remove('active')
          this.clearTools()
        } else {
          document
            .querySelectorAll('#toolbar .button')
            .forEach((el) => el.classList.remove('active'))
          ;(e.target as HTMLElement).classList.add('active')
          this.clearTools()
          this.selectTool(toolType)
        }
      })
    }
  }

  clearTools() {
    this.roadManager.disable()
    this.roadManager.destroyMode = false
    this.zoneManager.setZoneType('none')
  }

  selectTool(toolType: ToolType) {
    if (toolType === 'road') {
      this.roadManager.enable()
    } else if (toolType === 'bulldoze') {
      this.roadManager.enable()
      this.roadManager.destroyMode = true
    } else {
      this.zoneManager.setZoneType(
        this.zoneManager.getZoneType() === toolType ? 'none' : toolType
      )
    }
  }

  preload(): void {
    // Load your assets here
    this.load.image('roads', 'assets/images/tiles/roads.png')
    this.load.image('zones', 'assets/images/tiles/zones.png')
    // this.load.image('spawnables', 'assets/images/tiles/spawnables.png')
    this.load.atlas(
      'spawnablesAtlas',
      'assets/images/tiles/spawnables.png',
      'assets/images/tiles/spawnables.json'
    )
  }

  create(): void {
    this.setupToolbar()
    this.input.setDefaultCursor('url(assets/images/cursor.png), pointer')
    this.physics.world.setBounds(
      0,
      0,
      this.worldSize * this.gridCellSize,
      this.worldSize * this.gridCellSize
    )
    this.cameras.main.setBounds(
      0,
      0,
      this.worldSize * this.gridCellSize,
      this.worldSize * this.gridCellSize
    )

    // Put camera in the middle of the world
    // this.cameras.main.centerOn(
    //   this.worldSize * this.gridCellSize * 0.5,
    //   this.worldSize * this.gridCellSize * 0.5
    // )

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
    this.buildingSpawner = new BuildingSpawner(this.grid)
    this.demandManager = new DemandManager()

    this.roadManager.on('roadTilesChanged', (cells: RoadCell[]) => {
      this.zoneManager.updateRoadCells(cells)
      this.buildingSpawner.setRoadCells(cells)
    })

    this.zoneManager.on('zonedCellsChanged', (cells: Map<string, ZoneType>) => {
      this.buildingSpawner.setZonedCells(cells)

      const residentialCount = Array.from(cells.values()).filter(
        (type) => type === 'residential'
      ).length

      const commercialCount = Array.from(cells.values()).filter(
        (type) => type === 'commercial'
      ).length

      const industrialCount = Array.from(cells.values()).filter(
        (type) => type === 'industrial'
      ).length

      const zoneCounts: Record<ZoneType, number> = {
        residential: residentialCount,
        commercial: commercialCount,
        industrial: industrialCount,
        dezone: 0,
      }

      this.demandManager.updateZones(zoneCounts)

      console.log(this.demandManager.getDemands())
      updateUIData({ demand: this.demandManager.getDemands() })
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
    },
  },
  width: window.innerWidth,
  height: window.innerHeight,
  scene: [MainScene],
  backgroundColor: '#F8F6EB',
  // Additional configuration options
}

new Phaser.Game(config)
