import * as Phaser from 'phaser'
import { GameGrid } from './gameGrid' // Import your GameGrid class

export enum RoadTiles {
  HORIZONTAL = 0,
  HORIZONTAL_LEFT_END = 1,
  HORIZONTAL_RIGHT_END = 2,
  VERTICAL = 3,
  VERTICAL_TOP_END = 4,
  VERTICAL_BOTTOM_END = 5,
  CROSSROADS = 6,
  TOP_RIGHT_CORNER = 7,
  TOP_LEFT_CORNER = 8,
  BOTTOM_RIGHT_CORNER = 9,
  BOTTOM_LEFT_CORNER = 10,
  T_UP = 11,
  T_DOWN = 12,
  T_LEFT = 13,
  T_RIGHT = 14,
  CENTER = 15,
}

export type RoadCell = {
  x: number
  y: number
  connections: {
    top: boolean
    right: boolean
    bottom: boolean
    left: boolean
  }
}

export class RoadManager extends Phaser.Events.EventEmitter {
  gameGrid: GameGrid
  isDrawing: boolean
  startPoint: Phaser.Math.Vector2 | null
  endPoint: Phaser.Math.Vector2 | null
  graphics: Phaser.GameObjects.Graphics
  previewGraphics: Phaser.GameObjects.Graphics
  existingRoadTiles: RoadCell[]

  tilemap: Phaser.Tilemaps.Tilemap
  tileset: Phaser.Tilemaps.Tileset
  layer: Phaser.Tilemaps.TilemapLayer

  constructor(gameGrid: GameGrid) {
    super()
    this.existingRoadTiles = []
    this.gameGrid = gameGrid
    this.isDrawing = false
    this.startPoint = null
    this.endPoint = null
    this.graphics = this.gameGrid.scene.add.graphics({
      fillStyle: { color: 0x594f4f, alpha: 1 },
    })
    this.previewGraphics = this.gameGrid.scene.add.graphics({
      fillStyle: { color: 0x594f4f, alpha: 0.5 },
    }) // Initialize preview graphics

    this.createTilemap()

    // Listen to GameGrid events
    this.gameGrid.on('cellPointerDown', this.handleCellPointerDown.bind(this))
    this.gameGrid.on('cellPointerMove', this.handleCellPointerMove.bind(this))
    this.gameGrid.on('cellPointerUp', this.handleCellPointerUp.bind(this))
    this.gameGrid.on(
      'cellRightPointerDown',
      this.handleCellRightPointerDown.bind(this),
    )

    this.gameGrid.scene.input.mouse.disableContextMenu()
  }

  createTilemap() {
    const mapSize = 32 // Change this based on your game's requirements
    this.tilemap = this.gameGrid.scene.make.tilemap({
      tileWidth: 32,
      tileHeight: 32,
      width: this.gameGrid.getGridWidth(),
      height: this.gameGrid.getGridWidth(),
    })
    this.tileset = this.tilemap.addTilesetImage('roads', null, 32, 32)
    this.layer = this.tilemap.createBlankLayer('roadLayer', this.tileset)
  }

  public clearRoads(): void {
    this.graphics.clear()
    this.previewGraphics.clear()
    this.existingRoadTiles = [] // Reset the existing road tiles array
  }

  handleCellPointerDown(cell: Phaser.Math.Vector2): void {
    if (!this.isDrawing) {
      this.startPoint = cell
      this.endPoint = cell
      this.isDrawing = true
      this.previewRoad()
    } else {
      if (!this.isExistingRoadTile(cell)) {
        this.drawRoad()
        // Start new road immediately from the current cell
        this.isDrawing = true
        this.startPoint = cell
        this.endPoint = cell
        this.previewRoad()
      } else {
        // If clicked on an existing road tile, do not continue drawing
        this.drawRoad()
        this.isDrawing = false
        this.previewGraphics.clear()
        this.startPoint = null
        this.endPoint = null
      }
    }
  }

  isExistingRoadTile(cell: Phaser.Math.Vector2): boolean {
    return this.existingRoadTiles.some(
      (tile) => tile.x === cell.x && tile.y === cell.y,
    )
  }

  handleCellRightPointerDown(cell: Phaser.Math.Vector2): void {
    // Cancel the current drawing operation
    if (this.isDrawing) {
      this.isDrawing = false
      this.previewGraphics.clear()
      this.startPoint = null
      this.endPoint = null
    }
  }

  handleCellPointerMove(cell: Phaser.Math.Vector2): void {
    if (this.isDrawing && this.startPoint) {
      this.endPoint = this.snapTo90Degrees(this.startPoint, cell)
      this.previewRoad()
    } else if (!this.isDrawing) {
      this.startPoint = cell
      this.endPoint = cell
      this.previewRoad()
    }
  }

  handleCellPointerUp(cell: Phaser.Math.Vector2): void {
    // This can be used if you want to finalize road on mouse up instead of second click
  }

  drawRoad(): void {
    if (this.startPoint && this.endPoint) {
      const roadTiles = this.calculateRoadTiles(this.startPoint, this.endPoint)
      // Add new road tiles to the existing road tiles array
      // remove duplicates
      this.existingRoadTiles = this.existingRoadTiles.filter(
        (t) => !roadTiles.some((r) => r.x === t.x && r.y === t.y),
      )
      this.existingRoadTiles.push(...roadTiles)
      this.fillCells(roadTiles)
      this.emit('roadTilesChanged', roadTiles)
      this.isDrawing = false
      this.previewGraphics.clear()
      this.startPoint = null
      this.endPoint = null
    }
  }

  calculateRoadTiles(
    start: Phaser.Math.Vector2,
    end: Phaser.Math.Vector2,
  ): RoadCell[] {
    const xStart = Math.min(start.x, end.x)
    const xEnd = Math.max(start.x, end.x)
    const yStart = Math.min(start.y, end.y)
    const yEnd = Math.max(start.y, end.y)

    const isHorizontal = yStart === yEnd

    const tiles = []
    for (let x = xStart; x <= xEnd; x++) {
      for (let y = yStart; y <= yEnd; y++) {
        const existingTile = this.existingRoadTiles.find(
          (t) => t.x === x && t.y === y,
        )

        // if (existingTile) {
        //   console.log(existingTile.connections)
        // }

        const existingTileAbove = this.existingRoadTiles.find(
          (t) => t.x === x && t.y === y - 1,
        )

        const existingTileBelow = this.existingRoadTiles.find(
          (t) => t.x === x && t.y === y + 1,
        )

        const existingTileLeft = this.existingRoadTiles.find(
          (t) => t.x === x - 1 && t.y === y,
        )

        const existingTileRight = this.existingRoadTiles.find(
          (t) => t.x === x + 1 && t.y === y,
        )

        const shouldHaveTopConnectionHorizontal =
          isHorizontal && existingTileAbove?.connections.bottom

        const shouldHaveTopConnectionVertical = !isHorizontal && y !== yStart

        const topConnection =
          shouldHaveTopConnectionHorizontal || shouldHaveTopConnectionVertical

        // BOTTOM CONNECTION CHECK
        const shouldHaveBottomConnectionHorizontal =
          isHorizontal && (existingTileBelow?.connections.top || false)

        const shouldHaveBottomConnectionVertical = !isHorizontal && y !== yEnd

        const bottomConnection =
          shouldHaveBottomConnectionHorizontal ||
          shouldHaveBottomConnectionVertical

        // LEFT CONNECTION CHECK
        const shouldHaveLeftConnectionHorizontal =
          isHorizontal && (x !== xStart || existingTileLeft?.connections.right)

        const shouldHaveLeftConnectionVertical =
          !isHorizontal && existingTileLeft?.connections.right

        const leftConnection =
          shouldHaveLeftConnectionHorizontal || shouldHaveLeftConnectionVertical

        // RIGHT CONNECTION CHECK
        const shouldHaveRightConnectionHorizontal =
          isHorizontal && (x !== xEnd || existingTileRight?.connections.left)

        const shouldHaveRightConnectionVertical =
          !isHorizontal && existingTileRight?.connections.left

        const rightConnection =
          shouldHaveRightConnectionHorizontal ||
          shouldHaveRightConnectionVertical

        tiles.push({
          x,
          y,
          connections: {
            top: topConnection || existingTile?.connections.top || false,
            right: rightConnection || existingTile?.connections.right || false,
            bottom:
              bottomConnection || existingTile?.connections.bottom || false,
            left: leftConnection || existingTile?.connections.left || false,
          },
        })
      }
    }
    return tiles
  }

  previewRoad(): void {
    if (this.startPoint && this.endPoint) {
      this.previewGraphics.clear() // Clear previous preview
      const xStart =
        Math.min(this.startPoint.x, this.endPoint.x) *
        this.gameGrid.getGridCellSize()
      const yStart =
        Math.min(this.startPoint.y, this.endPoint.y) *
        this.gameGrid.getGridCellSize()
      const width =
        (Math.abs(this.startPoint.x - this.endPoint.x) + 1) *
        this.gameGrid.getGridCellSize()
      const height =
        (Math.abs(this.startPoint.y - this.endPoint.y) + 1) *
        this.gameGrid.getGridCellSize()

      // Draw a rectangle as a preview (you can style this as needed)
      this.previewGraphics.fillStyle(0x594f4f, 0.5) // Semi-transparent
      this.previewGraphics.fillRect(xStart, yStart, width, height)
    }
  }

  fillCells(roadTiles: RoadCell[]): void {
    roadTiles.forEach((tile) => {
      const tileType = this.getTileType(tile)
      this.layer.putTileAt(tileType, tile.x, tile.y)
    })
    // const xStart = Math.min(start.x, end.x)
    // const xEnd = Math.max(start.x, end.x)
    // const yStart = Math.min(start.y, end.y)
    // const yEnd = Math.max(start.y, end.y)
    // const isHorizontal = yStart === yEnd

    // for (let x = xStart; x <= xEnd; x++) {
    //   for (let y = yStart; y <= yEnd; y++) {
    //     const tileIndex = getRoadTileIndex(
    //       x,
    //       y,
    //       this.existingRoadTiles,
    //       isHorizontal,
    //       xStart,
    //       xEnd,
    //       yStart,
    //       yEnd,
    //     )
    //     this.layer.putTileAt(tileIndex, x, y)
    //   }
    // }
  }

  getTileType(tile: RoadCell): RoadTiles {
    if (
      tile.connections.top &&
      tile.connections.right &&
      tile.connections.bottom &&
      tile.connections.left
    ) {
      return RoadTiles.CROSSROADS
    } else if (
      tile.connections.top &&
      tile.connections.right &&
      tile.connections.bottom
    ) {
      return RoadTiles.T_RIGHT
    } else if (
      tile.connections.top &&
      tile.connections.right &&
      tile.connections.left
    ) {
      return RoadTiles.T_UP
    } else if (
      tile.connections.top &&
      tile.connections.bottom &&
      tile.connections.left
    ) {
      return RoadTiles.T_LEFT
    } else if (
      tile.connections.right &&
      tile.connections.bottom &&
      tile.connections.left
    ) {
      return RoadTiles.T_DOWN
    } else if (tile.connections.top && tile.connections.right) {
      return RoadTiles.BOTTOM_LEFT_CORNER
    } else if (tile.connections.top && tile.connections.bottom) {
      return RoadTiles.VERTICAL
    } else if (tile.connections.top && tile.connections.left) {
      return RoadTiles.BOTTOM_RIGHT_CORNER
    } else if (tile.connections.right && tile.connections.bottom) {
      return RoadTiles.TOP_LEFT_CORNER
    } else if (tile.connections.right && tile.connections.left) {
      return RoadTiles.HORIZONTAL
    } else if (tile.connections.bottom && tile.connections.left) {
      return RoadTiles.TOP_RIGHT_CORNER
    } else if (tile.connections.top) {
      return RoadTiles.VERTICAL_BOTTOM_END
    } else if (tile.connections.right) {
      return RoadTiles.HORIZONTAL_LEFT_END
    } else if (tile.connections.bottom) {
      return RoadTiles.VERTICAL_TOP_END
    } else if (tile.connections.left) {
      return RoadTiles.HORIZONTAL_RIGHT_END
    } else {
      return RoadTiles.CENTER
    }
  }

  snapTo90Degrees(
    start: Phaser.Math.Vector2,
    end: Phaser.Math.Vector2,
  ): Phaser.Math.Vector2 {
    let dx = end.x - start.x
    let dy = end.y - start.y

    if (Math.abs(dx) > Math.abs(dy)) {
      return new Phaser.Math.Vector2(end.x, start.y)
    } else {
      return new Phaser.Math.Vector2(start.x, end.y)
    }
  }
}
