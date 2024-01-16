import * as Phaser from 'phaser'
import { Events } from 'phaser'

export class GameGrid extends Events.EventEmitter {
  scene: Phaser.Scene
  private gridCellSize: number
  private width: number
  private height: number
  private lastHoveredCell: Phaser.Math.Vector2 | null
  private graphics: Phaser.GameObjects.Graphics

  private startDragPointerPosition: Phaser.Math.Vector2 | null = null
  private isDragging: boolean = false

  constructor(
    scene: Phaser.Scene,
    gridCellSize: number = 32,
    width: number = 100,
    height: number = 100
  ) {
    super()

    this.scene = scene
    this.gridCellSize = gridCellSize
    this.width = width
    this.height = height
    this.lastHoveredCell = null

    // Setup event listeners for pointer actions
    this.scene.input.on('pointerdown', this.handlePointerDown.bind(this))
    this.scene.input.on('pointermove', this.handlePointerMove.bind(this))
    this.scene.input.on('pointerup', this.handlePointerUp.bind(this))
    this.scene.input.on('pointerupoutside', this.handlePointerUp.bind(this))
  }

  getGridWidth(): number {
    return this.width
  }

  getGridHeight(): number {
    return this.height
  }

  getGridCellSize(): number {
    return this.gridCellSize
  }

  drawGrid(): void {
    const gridWidth = this.width * this.gridCellSize
    const gridHeight = this.height * this.gridCellSize

    this.graphics = this.scene.add.graphics({
      lineStyle: { width: 1, color: 0xdddddd, alpha: 0.5 },
    })

    for (let x = 0; x < gridWidth; x += this.gridCellSize) {
      this.graphics.lineBetween(x, 0, x, gridHeight)
    }

    for (let y = 0; y < gridHeight; y += this.gridCellSize) {
      this.graphics.lineBetween(0, y, gridWidth, y)
    }
  }

  handlePointerDown(pointer: Phaser.Input.Pointer): void {
    this.startDragPointerPosition = pointer.position.clone()

    const cell = this.getWorldPointToGridCell(pointer)

    if (pointer.rightButtonDown()) {
      this.cellRightPointerDown(cell)
    } else {
      this.cellPointerDown(cell)
    }
  }

  handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.startDragPointerPosition && !this.isDragging) {
      const distance = this.scene.cameras.main
        .getWorldPoint(
          this.startDragPointerPosition.x,
          this.startDragPointerPosition.y
        )
        .distance(pointer.position)

      if (distance > 10) {
        this.cellPointerStartDrag(
          this.getWorldPointToGridCell(this.startDragPointerPosition)
        )
      }
    }

    const cell = this.getWorldPointToGridCell(pointer)
    if (!this.lastHoveredCell || !this.lastHoveredCell.equals(cell)) {
      this.cellPointerMove(cell)
      this.cellPointerDrag(cell)
      this.lastHoveredCell = cell.clone()
    }
  }

  handlePointerUp(pointer: Phaser.Input.Pointer): void {
    this.startDragPointerPosition = null

    const cell = this.getWorldPointToGridCell(pointer)
    this.cellPointerUp(cell)
    this.cellPointerEndDrag(cell)
  }

  getWorldPointToGridCell<T extends { x: number; y: number }>(
    pointer: T
  ): Phaser.Math.Vector2 {
    const worldPoint = this.scene.cameras.main.getWorldPoint(
      pointer.x,
      pointer.y
    )

    const p = new Phaser.Math.Vector2(
      Math.floor(worldPoint.x / this.gridCellSize),
      Math.floor(worldPoint.y / this.gridCellSize)
    )

    return p
  }

  cellRightPointerDown(cell: Phaser.Math.Vector2): void {
    this.emit('cellRightPointerDown', cell)
  }

  cellPointerDown(cell: Phaser.Math.Vector2): void {
    this.emit('cellPointerDown', cell)
  }

  cellPointerMove(cell: Phaser.Math.Vector2): void {
    this.emit('cellPointerMove', cell)
  }

  cellPointerUp(cell: Phaser.Math.Vector2): void {
    this.emit('cellPointerUp', cell)
  }

  cellPointerClick(cell: Phaser.Math.Vector2): void {
    this.emit('cellPointerClick', cell)
  }

  cellPointerStartDrag(cell: Phaser.Math.Vector2): void {
    this.isDragging = true
    this.emit('cellPointerStartDrag', cell)
  }

  cellPointerDrag(cell: Phaser.Math.Vector2): void {
    if (this.isDragging) {
      this.emit('cellPointerDrag', cell)
    }
  }

  cellPointerEndDrag(cell: Phaser.Math.Vector2): void {
    if (this.isDragging) {
      this.isDragging = false
      this.emit('cellPointerEndDrag', cell)
    }
  }
}
