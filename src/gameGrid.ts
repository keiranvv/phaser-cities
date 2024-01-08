import * as Phaser from 'phaser'
import { Events } from 'phaser'

export class GameGrid extends Events.EventEmitter {
  scene: Phaser.Scene
  private gridCellSize: number
  private width: number
  private height: number
  private lastHoveredCell: Phaser.Math.Vector2 | null
  private currentHoveredCell: Phaser.Math.Vector2 | null
  private graphics: Phaser.GameObjects.Graphics
  private cells: { x: number; y: number; type: string }[]

  constructor(
    scene: Phaser.Scene,
    gridCellSize: number = 32,
    width: number = 100,
    height: number = 100,
  ) {
    super()

    this.scene = scene
    this.gridCellSize = gridCellSize
    this.width = width
    this.height = height
    this.lastHoveredCell = null
    this.currentHoveredCell = null

    this.cells = []

    // Setup event listeners for pointer actions
    this.scene.input.on('pointerdown', this.handlePointerDown.bind(this))
    this.scene.input.on('pointermove', this.handlePointerMove.bind(this))
    this.scene.input.on('pointerup', this.handlePointerUp.bind(this))
    this.scene.input.on('pointerupoutside', this.handlePointerUp.bind(this))
  }

  getGridWidth(): number {
    return this.width
  }

  getGridCellSize(): number {
    return this.gridCellSize
  }

  drawGrid(): void {
    const gridWidth = this.width * this.gridCellSize
    const gridHeight = this.height * this.gridCellSize

    this.graphics = this.scene.add.graphics({
      lineStyle: { width: 1, color: 0xdddddd },
    })

    // Draw vertical lines
    for (let x = 0; x < gridWidth; x += this.gridCellSize) {
      this.graphics.lineBetween(x, 0, x, gridHeight)
    }

    // Draw horizontal lines
    for (let y = 0; y < gridHeight; y += this.gridCellSize) {
      this.graphics.lineBetween(0, y, gridWidth, y)
    }
  }

  handlePointerDown(pointer: Phaser.Input.Pointer): void {
    const cell = this.getWorldPointToGridCell(pointer)

    if (pointer.rightButtonDown()) {
      this.cellRightPointerDown(cell)
    } else {
      this.cellPointerDown(cell)
    }
  }

  handlePointerMove(pointer: Phaser.Input.Pointer): void {
    const cell = this.getWorldPointToGridCell(pointer)
    this.currentHoveredCell = cell
    if (!this.lastHoveredCell || !this.lastHoveredCell.equals(cell)) {
      this.cellPointerMove(cell)
      this.lastHoveredCell = cell.clone()
    }
  }

  handlePointerUp(pointer: Phaser.Input.Pointer): void {
    const cell = this.getWorldPointToGridCell(pointer)
    this.cellPointerUp(cell)
  }

  getWorldPointToGridCell(pointer: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    const worldPoint = this.scene.cameras.main.getWorldPoint(
      pointer.x,
      pointer.y,
    )
    const p = new Phaser.Math.Vector2(
      Math.floor(worldPoint.x / this.gridCellSize),
      Math.floor(worldPoint.y / this.gridCellSize),
    )

    return p
  }

  cellRightPointerDown(cell: Phaser.Math.Vector2): void {
    // Handle cell right pointer down event
    this.emit('cellRightPointerDown', cell)
  }

  cellPointerDown(cell: Phaser.Math.Vector2): void {
    // Handle cell pointer down event
    this.emit('cellPointerDown', cell)
  }

  cellPointerMove(cell: Phaser.Math.Vector2): void {
    // Handle cell pointer move event
    this.emit('cellPointerMove', cell)
  }

  cellPointerUp(cell: Phaser.Math.Vector2): void {
    // Handle cell pointer up event
    this.emit('cellPointerUp', cell)
  }

  cellPointerClick(cell: Phaser.Math.Vector2): void {
    // Handle cell pointer click event
    this.emit('cellPointerClick', cell)
  }
}
