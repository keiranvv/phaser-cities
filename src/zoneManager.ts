import { AreaSelect } from './areaSelect'
import { GameGrid } from './gameGrid'
import { RoadCell } from './roadManager'

export class ZoneManager {
  private roadCells: RoadCell[]
  private gameGrid: GameGrid
  private zoneableCells: Map<string, boolean> = new Map()
  private zonedCells: Map<string, 'residential' | 'commercial' | 'industrial'> =
    new Map()
  private areaSelect: AreaSelect

  private zoneType: 'residential' | 'commercial' | 'industrial' | null = null
  public zoneColors = {
    residential: 0x498467,
    commercial: 0x5da9e9,
    industrial: 0xd98324,
  }

  tilemap: Phaser.Tilemaps.Tilemap
  tileset: Phaser.Tilemaps.Tileset
  layer: Phaser.Tilemaps.TilemapLayer

  constructor(roadCells: RoadCell[], gameGrid: GameGrid) {
    this.roadCells = roadCells
    this.gameGrid = gameGrid
    this.areaSelect = new AreaSelect(gameGrid)

    this.areaSelect.on('areaSelected', this.handleAreaSelect.bind(this))

    this.createTilemap()
  }

  public setZoneType(
    zoneType: 'residential' | 'commercial' | 'industrial' | 'none'
  ) {
    if (zoneType === 'none') {
      this.zoneType = null
      this.areaSelect.disable()
      return
    }

    this.zoneType = zoneType
    this.areaSelect.setColor(this.zoneColors[zoneType])
    this.areaSelect.enable()
  }

  public getZoneType() {
    return this.zoneType
  }

  createTilemap() {
    this.tilemap = this.gameGrid.scene.make.tilemap({
      tileWidth: 32,
      tileHeight: 32,
      width: this.gameGrid.getGridWidth(),
      height: this.gameGrid.getGridWidth(),
    })
    this.tileset = this.tilemap.addTilesetImage('zones', null, 32, 32)
    this.layer = this.tilemap.createBlankLayer('zoneLayer', this.tileset)
  }

  private handleAreaSelect({
    start,
    end,
  }: {
    start: Phaser.Math.Vector2
    end: Phaser.Math.Vector2
  }) {
    const startX = Math.min(start.x, end.x)
    const startY = Math.min(start.y, end.y)
    const endX = Math.max(start.x, end.x)
    const endY = Math.max(start.y, end.y)

    for (let x = startX; x <= endX; x++) {
      for (let y = startY; y <= endY; y++) {
        if (this.zoneableCells.has(`${x}_${y}`)) {
          this.zoneCell(x, y)
        }
      }
    }
  }

  private zoneCell(x: number, y: number) {
    const key = `${x}_${y}`
    this.zoneableCells.delete(key)
    this.zonedCells.set(key, this.zoneType)
    this.tilemap.putTileAt(
      this.zoneType === 'residential'
        ? 1
        : this.zoneType === 'commercial'
        ? 2
        : this.zoneType === 'industrial'
        ? 3
        : 0,
      x,
      y
    )
  }

  public updateRoadCells(roadCells: RoadCell[]) {
    this.roadCells = roadCells
    this.displayZoneableTiles()
  }

  private displayZoneableTiles() {
    this.zoneableCells = new Map<string, boolean>()

    this.tilemap.fill(
      null,
      0,
      0,
      this.gameGrid.getGridWidth(),
      this.gameGrid.getGridHeight()
    )

    this.roadCells.forEach((roadCell) => {
      const { x, y } = roadCell

      for (let i = 0; i <= 4; i++) {
        if (
          this.isZoneable(roadCell, x + i, y) &&
          !this.zoneableCells.has(`${x + i}_${y}`)
        ) {
          this.drawZoneableTile(x + i, y)
          this.zoneableCells.set(`${x + i}_${y}`, true)
        }
        if (
          this.isZoneable(roadCell, x - i, y) &&
          !this.zoneableCells.has(`${x - i}_${y}`)
        ) {
          this.drawZoneableTile(x - i, y)
          this.zoneableCells.set(`${x - i}_${y}`, true)
        }
        if (
          this.isZoneable(roadCell, x, y + i) &&
          !this.zoneableCells.has(`${x}_${y + i}`)
        ) {
          this.drawZoneableTile(x, y + i)
          this.zoneableCells.set(`${x}_${y + i}`, true)
        }
        if (
          this.isZoneable(roadCell, x, y - i) &&
          !this.zoneableCells.has(`${x}_${y - i}`)
        ) {
          this.drawZoneableTile(x, y - i)
          this.zoneableCells.set(`${x}_${y - i}`, true)
        }
      }
    })
  }

  private getOpenSidesAndAxis(roadCell: RoadCell) {
    const sides = roadCell.connections
    const openSides = {
      count: 0,
      axis: null,
    }

    if (!sides.top) openSides.count++
    if (!sides.bottom) openSides.count++
    if (!sides.left) openSides.count++
    if (!sides.right) openSides.count++

    if (sides.top || sides.bottom) {
      openSides.axis = 'vertical'
    } else {
      openSides.axis = 'horizontal'
    }

    return openSides
  }

  private isZoneable(originRoadCell: RoadCell, x: number, y: number) {
    if (this.isRoad(x, y)) {
      return false
    }

    if (
      x === 0 ||
      y === 0 ||
      x >= this.gameGrid.getGridWidth() - 1 ||
      y >= this.gameGrid.getGridHeight() - 1
    ) {
      return false
    }

    const { count, axis } = this.getOpenSidesAndAxis(originRoadCell)

    if (count === 4) return false

    if (originRoadCell.connections.top && y < originRoadCell.y) return false
    if (originRoadCell.connections.bottom && y > originRoadCell.y) return false
    if (originRoadCell.connections.left && x < originRoadCell.x) return false
    if (originRoadCell.connections.right && x > originRoadCell.x) return false

    if (count >= 3) {
      // Only allow zoning on the open sides if they are on the opposite axis
      if (axis === 'vertical' && x === originRoadCell.x) return false
      if (axis === 'horizontal' && y === originRoadCell.y) return false
    }

    return true
  }

  private isRoad(x: number, y: number) {
    return this.roadCells.some((roadCell) => {
      return roadCell.x === x && roadCell.y === y
    })
  }

  drawZoneableTile(x, y) {
    this.tilemap.putTileAt(0, x, y)
  }
}
