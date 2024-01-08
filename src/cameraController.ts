import * as Phaser from 'phaser'

const zoomLevels = [0.5, 0.75, 1, 1.25, 1.5, 2]

export class CameraController {
  private scene: Phaser.Scene
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys
  private zoomLevel = 1

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.cursors = this.scene.input.keyboard.createCursorKeys()

    // map cursors to WASD
    this.cursors.up = this.scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.W,
    )
    this.cursors.down = this.scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.S,
    )
    this.cursors.left = this.scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.A,
    )
    this.cursors.right = this.scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.D,
    )

    // Zooming
    this.scene.input.on(
      'wheel',
      (
        pointer: Phaser.Input.Pointer,
        gameObjects: any[],
        deltaX: number,
        deltaY: number,
        deltaZ: number,
      ) => {
        // Get the current zoom level index
        const currentZoomIndex = zoomLevels.indexOf(
          this.scene.cameras.main.zoom,
        )

        // Get the new zoom level index
        const newZoomIndex = Phaser.Math.Clamp(
          currentZoomIndex + (deltaY > 0 ? -1 : 1),
          0,
          zoomLevels.length - 1,
        )

        const newZoom = zoomLevels[newZoomIndex]

        // Get the world position before zooming
        const worldPointBeforeZoom = this.scene.cameras.main.getWorldPoint(
          pointer.x,
          pointer.y,
        )

        // Apply the new zoom
        this.scene.cameras.main.zoom = newZoom

        // Get the world position after zooming
        const worldPointAfterZoom = this.scene.cameras.main.getWorldPoint(
          pointer.x,
          pointer.y,
        )

        // Calculate the difference and adjust the camera position
        const worldPointToScroll = worldPointAfterZoom.subtract(
          worldPointBeforeZoom,
        )
        this.scene.cameras.main.scrollX -= worldPointToScroll.x
        this.scene.cameras.main.scrollY -= worldPointToScroll.y
      },
    )
  }

  update(): void {
    // Camera panning
    if (this.cursors.left.isDown) {
      this.scene.cameras.main.scrollX -= 5
    } else if (this.cursors.right.isDown) {
      this.scene.cameras.main.scrollX += 5
    }

    if (this.cursors.up.isDown) {
      this.scene.cameras.main.scrollY -= 5
    } else if (this.cursors.down.isDown) {
      this.scene.cameras.main.scrollY += 5
    }
  }
}
