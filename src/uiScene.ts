import * as Phaser from 'phaser'

export class UIScene extends Phaser.Scene {
  private buttons: Phaser.GameObjects.Text[]
  private buttonConfig: { id: string; label: string; children?: any[] }[]
  private currentState: string | null
  private toolbarHeight: number = 50
  private buttonWidth: number = 20
  private buttonMargin: number = 5

  constructor() {
    super({ key: 'UIScene', active: true })
    this.currentState = null

    this.buttonConfig = [
      {
        id: 'road',
        label: 'R',
        children: [
          { id: 'road1', label: '1' },
          { id: 'road2', label: '2' },
          // More children for 'Road'
        ],
      },
      { id: 'bulldoze', label: 'B' },
      // More buttons here
    ]

    this.buttons = []
  }

  create(): void {
    const bottom = window.innerHeight
    const right = window.innerWidth

    // Main toolbar
    const toolbar = this.add.graphics()
    toolbar.fillStyle(0xffffff, 1)
    toolbar.fillRect(
      10,
      bottom - this.toolbarHeight,
      right - 20,
      this.toolbarHeight,
    )

    // Create buttons
    // this.createButtons(this.buttonConfig, 10)

    this.input.on(
      'pointerdown',
      (
        pointer: Phaser.Input.Pointer,
        currentlyOver: Phaser.GameObjects.GameObject[],
      ) => {
        if (currentlyOver.some((obj) => obj.scene === this)) {
          pointer.event.stopPropagation()
        }
      },
    )
  }

  createButtons(buttonConfigs: any[], startX: number): void {
    const top = window.innerHeight - this.toolbarHeight
    let currentX = startX
    buttonConfigs.forEach((config) => {
      const button = this.add
        .text(currentX, top, config.label, { fontSize: '16px', color: '#000' })
        .setInteractive()
        .on('pointerdown', () => this.handleButtonClick(config))

      this.buttons.push(button)
      currentX += this.buttonWidth + this.buttonMargin

      // If button has children, hide them initially
      // if (config.children) {
      //   config.children.forEach((child) => {
      //     child.button = this.add
      //       .text(35, currentY, child.label, {
      //         fontSize: '16px',
      //         color: '#888',
      //       })
      //       .setVisible(false)
      //       .setInteractive()
      //       .on('pointerdown', () => this.handleButtonClick(child))
      //     this.buttons.push(child.button)
      //     currentY += this.buttonHeight + this.buttonMargin
      //   })
      // }
    })
  }

  handleButtonClick(config: any): void {
    if (this.currentState === config.id) {
      this.currentState = null
    } else {
      this.currentState = config.id
    }

    // Toggle visibility of child buttons if any
    if (config.children) {
      config.children.forEach((child) => {
        child.button.setVisible(!child.button.visible)
      })
    }

    this.updateButtonStyles()
  }

  updateButtonStyles(): void {
    this.buttons.forEach((button) => {
      const config = this.findConfigForButton(button)
      if (config && this.currentState === config.id) {
        button.setColor('#f00')
      } else {
        button.setColor('#000')
      }
    })
  }

  findConfigForButton(button: Phaser.GameObjects.Text): any {
    return (
      this.buttonConfig.find((cfg) => cfg.label === button.text) ||
      this.buttonConfig.find((cfg) =>
        cfg.children?.some((child) => child.label === button.text),
      )
    )
  }
}
