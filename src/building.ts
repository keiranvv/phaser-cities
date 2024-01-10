type BuildingType = 'spawnable' | 'placeable'

class Building {
  constructor(public type: BuildingType, public name: string) {}

  public render(graphics: Phaser.GameObjects.Graphics) {}
}
