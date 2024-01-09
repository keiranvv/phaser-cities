import * as Phaser from 'phaser'
import { GameGrid } from './gameGrid'

export class AreaSelect extends Phaser.Events.EventEmitter {
  private isEnabled: boolean = false
  private gameGrid: GameGrid
  private isDragging: boolean = false
  private startCell: Phaser.Math.Vector2 | null = null
  private previewGraphics: Phaser.GameObjects.Graphics | null = null

  private color: number = 0x000000

  private handleCellPointerStartDrag: (cell: Phaser.Math.Vector2) => void
  private handleCellPointerDrag: (cell: Phaser.Math.Vector2) => void
  private handleCellPointerEndDrag: (cell: Phaser.Math.Vector2) => void
  private handleCellPointerMove: (cell: Phaser.Math.Vector2) => void

  public showCursor: boolean = false

  constructor(gameGrid: GameGrid) {
    super()

    this.gameGrid = gameGrid

    this.previewGraphics = this.gameGrid.scene.add.graphics({
      lineStyle: { width: 1, color: this.color, alpha: 0.4 },
      fillStyle: { color: this.color, alpha: 0.2 },
    })

    this.handleCellPointerStartDrag = this._handleCellPointerStartDrag.bind(
      this,
    )
    this.handleCellPointerDrag = this._handleCellPointerDrag.bind(this)
    this.handleCellPointerEndDrag = this._handleCellPointerEndDrag.bind(this)
    this.handleCellPointerMove = this._handleCellPointerMove.bind(this)
  }

  public setColor(color: number) {
    this.color = color

    this.previewGraphics.clear()

    this.previewGraphics.setDefaultStyles({
      lineStyle: { width: 1, color: this.color, alpha: 0.4 },
      fillStyle: { color: this.color, alpha: 0.2 },
    })
  }

  enable() {
    this.isEnabled = true
    this.gameGrid.on('cellPointerStartDrag', this.handleCellPointerStartDrag)
    this.gameGrid.on('cellPointerDrag', this.handleCellPointerDrag)
    this.gameGrid.on('cellPointerEndDrag', this.handleCellPointerEndDrag)

    this.gameGrid.on('cellPointerMove', this.handleCellPointerMove)
  }

  disable() {
    this.isEnabled = false

    this.gameGrid.off('cellPointerStartDrag', this.handleCellPointerStartDrag)
    this.gameGrid.off('cellPointerDrag', this.handleCellPointerDrag)
    this.gameGrid.off('cellPointerEndDrag', this.handleCellPointerEndDrag)

    this.gameGrid.off('cellPointerMove', this.handleCellPointerMove)

    this.previewGraphics.clear()
    this.startCell = null
    this.isDragging = false
  }

  private _handleCellPointerStartDrag(cell: Phaser.Math.Vector2) {
    this.isDragging = true
    this.startCell = cell.clone()
  }

  private _handleCellPointerDrag(cell: Phaser.Math.Vector2) {
    if (!this.isDragging) return

    const startX = Math.min(this.startCell.x, cell.x)
    const startY = Math.min(this.startCell.y, cell.y)
    const endX = Math.max(this.startCell.x, cell.x)
    const endY = Math.max(this.startCell.y, cell.y)

    const width = endX - startX + 1
    const height = endY - startY + 1

    this.previewGraphics.clear()
    this.previewGraphics.fillRect(
      startX * this.gameGrid.getGridCellSize(),
      startY * this.gameGrid.getGridCellSize(),
      width * this.gameGrid.getGridCellSize(),
      height * this.gameGrid.getGridCellSize(),
    )
  }

  private _handleCellPointerEndDrag(cell: Phaser.Math.Vector2) {
    this.emit('areaSelected', {
      start: this.startCell,
      end: cell,
    })

    this.previewGraphics.clear()
    this.startCell = null
    this.isDragging = false
  }

  private _handleCellPointerMove(cell: Phaser.Math.Vector2) {
    if (this.isDragging || !this.isEnabled || !this.showCursor) return

    // fill in current cell
    this.previewGraphics.clear()
    this.previewGraphics.fillRect(
      cell.x * this.gameGrid.getGridCellSize(),
      cell.y * this.gameGrid.getGridCellSize(),
      this.gameGrid.getGridCellSize(),
      this.gameGrid.getGridCellSize(),
    )
  }
}
