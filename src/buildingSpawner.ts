import * as Phaser from 'phaser'

import { GameGrid } from './gameGrid'
import { ZoneType } from './zoneManager'

export type Spawnable = {
  name: string
  size: {
    width: number
    height: number
  }
  tilemap: {
    index: number
  }
  type: 'residential' | 'commercial' | 'industrial'
}

import spawnables from './data/spawnables.json'
import { RoadCell } from './roadManager'
import { calculateCoordinateDimensions } from './util/grid'

const maxBuildingWidths = Object.entries(spawnables).reduce(
  (acc, curr) => {
    const max = curr[1].reduce((acc, curr) => {
      if (curr.size.width > acc) {
        return curr.size.width
      }
      return acc
    }, 0)

    return {
      ...acc,
      [curr[0]]: max,
    }
  },
  { residential: 0, commercial: 0, industrial: 0 }
)

const maxBuildingHeights = Object.entries(spawnables).reduce(
  (acc, curr) => {
    const max = curr[1].reduce((acc, curr) => {
      if (curr.size.height > acc) {
        return curr.size.height
      }
      return acc
    }, 0)

    return {
      ...acc,
      [curr[0]]: max,
    }
  },
  { residential: 0, commercial: 0, industrial: 0 }
)

class Building {
  footprint: { x: number; y: number }[]

  constructor(
    public readonly spawnable: Spawnable,
    public readonly x: number,
    public readonly y: number,
    public readonly facingDirection: 'top' | 'right' | 'bottom' | 'left',
    public sprite?: Phaser.GameObjects.Sprite | null
  ) {
    this.footprint = []

    for (let ix = 0; ix < spawnable.size.width; ix++) {
      for (let iy = 0; iy < spawnable.size.height; iy++) {
        if (facingDirection === 'top') {
          this.footprint.push({ x: x + ix, y: y + iy })
          continue
        }

        if (facingDirection === 'right') {
          this.footprint.push({ x: x - iy, y: y + ix })
          continue
        }

        if (facingDirection === 'bottom') {
          this.footprint.push({ x: x + ix, y: y - iy })
          continue
        }

        if (facingDirection === 'left') {
          this.footprint.push({ x: x + iy, y: y + ix })
          continue
        }
      }
    }
  }
}

export class BuildingSpawner extends Phaser.Events.EventEmitter {
  private _gameGrid: GameGrid
  private _zonedCells: Map<string, ZoneType> = new Map()
  private _roadCells: RoadCell[] = []
  private _roadCellKeys: string[] = []
  private _spawnedBuildings: Building[] = []

  private _occupiedCells: Map<string, Building> = new Map()

  tilemap: Phaser.Tilemaps.Tilemap
  tileset: Phaser.Tilemaps.Tileset
  layer: Phaser.Tilemaps.TilemapLayer

  constructor(gameGrid: GameGrid) {
    super()
    this._gameGrid = gameGrid
    ;(window as any).ta = this.getCellSpawnableArea.bind(this)
  }

  public setZonedCells(zonedCells: Map<string, ZoneType>) {
    this._zonedCells = zonedCells

    this.removeInvalidSpawnables()
    this.update()
  }

  public setRoadCells(roadCells: RoadCell[]) {
    this._roadCells = roadCells

    this._roadCellKeys = roadCells.map((cell) => `${cell.x}_${cell.y}`)

    this.removeInvalidSpawnables()
    this.update()
  }

  private removeInvalidSpawnables() {
    // Filter out buildings that are no longer valid
    this._spawnedBuildings = this._spawnedBuildings.filter((building) => {
      const isValid = building.footprint.every((fp) =>
        this._zonedCells.has(`${fp.x}_${fp.y}`)
      )

      // If the building is not valid, remove its sprite from the scene
      if (!isValid && building.sprite) {
        building.sprite.destroy()
      }

      return isValid
    })

    this._occupiedCells = new Map(
      this._spawnedBuildings.flatMap((building) =>
        building.footprint.map((fp) => [`${fp.x}_${fp.y}`, building])
      )
    )
  }

  private async update() {
    const clusters = this.findContiguousZones(
      this.getZonedCellsWithoutBuildings()
    )

    if (clusters.size === 0) {
      return
    }

    for (const [zoneType, cluster] of clusters.entries()) {
      for (const points of cluster) {
        let p = [...points]

        while (p.length > 0) {
          const { width, height } = this.getClusterSize(p)

          let possibleSpawnCells = this.findSpawnableCells(p)

          if (!possibleSpawnCells || possibleSpawnCells.length === 0) {
            break
          }

          possibleSpawnCells = possibleSpawnCells
            .map((p) => {
              const { width, height } = this.getCellSpawnableArea(
                p.x,
                p.y,
                zoneType
              )

              return {
                ...p,
                roadSides: p.roadSides.filter((s) => {
                  const spawnablePossibilities =
                    this.getSpawnableBuildingForZoneTypeAndDimensions(
                      zoneType,
                      width,
                      height,
                      s
                    )

                  return spawnablePossibilities.length > 0
                }),
              }
            })
            .filter((p) => p.roadSides.length > 0)

          if (possibleSpawnCells.length === 0) {
            break
          }

          const direction =
            possibleSpawnCells[0].roadSides[
              Math.floor(Math.random() * possibleSpawnCells[0].roadSides.length)
            ]

          let spawnablePossibilities =
            this.getSpawnableBuildingForZoneTypeAndDimensions(
              zoneType,
              width,
              height,
              direction
            )

          spawnablePossibilities = spawnablePossibilities.filter((s) =>
            this.canSpawnBuilding(
              s,
              possibleSpawnCells[0].x,
              possibleSpawnCells[0].y,
              direction
            )
          )

          if (spawnablePossibilities.length === 0) {
            break
          }

          const spawnable =
            spawnablePossibilities[
              Math.floor(Math.random() * spawnablePossibilities.length)
            ]

          if (!spawnable) {
            break
          }

          const b = new Building(
            spawnable,
            possibleSpawnCells[0].x,
            possibleSpawnCells[0].y,
            direction
          )

          b.sprite = this.renderBuilding(b)

          this._spawnedBuildings.push(b)
          b.footprint.forEach((fp) => {
            this._occupiedCells.set(`${fp.x}_${fp.y}`, b)
          })

          p = p.filter((point) => {
            const [x, y] = point.split('_').map(Number)

            return !b.footprint.some((f) => f.x === x && f.y === y)
          })

          // sleep 300ms
          await new Promise((resolve) => setTimeout(resolve, 300))
        }
      }
    }
  }

  private getZonedCellsWithoutBuildings() {
    const result = Array.from(this._zonedCells.entries())
      .filter(([key]) => !this._occupiedCells.has(key))
      .map(([key, value]) => ({ key, value }))

    return new Map(result.map(({ key, value }) => [key, value]))
  }

  private canSpawnBuilding(
    spawnable: Spawnable,
    x: number,
    y: number,
    direction: 'top' | 'right' | 'bottom' | 'left'
  ) {
    const building = new Building(spawnable, x, y, direction)

    const canSpawn = building.footprint.every(
      (f) =>
        this._zonedCells.has(`${f.x}_${f.y}`) &&
        !this._occupiedCells.has(`${f.x}_${f.y}`)
    )

    return canSpawn
  }

  private renderBuilding({ facingDirection, x, y, spawnable }: Building) {
    const xOffset =
      facingDirection === 'right' ? x - spawnable.size.width + 1 : x
    const yOffset =
      facingDirection === 'bottom' ? y - spawnable.size.height + 1 : y

    return this._gameGrid.scene.add
      .sprite(
        xOffset * this._gameGrid.getGridCellSize(),
        yOffset * this._gameGrid.getGridCellSize(),
        'spawnablesAtlas',
        spawnable.name
      )
      .setOrigin(0, 0)
  }

  private getCellSpawnableArea(
    x: number,
    y: number,
    zoneType: ZoneType
  ): { width: number; height: number } {
    let w = 0
    let h = 0

    const maxWidth = maxBuildingWidths[zoneType]
    const maxHeight = maxBuildingHeights[zoneType]

    for (let i = 0; i < Math.max(maxWidth, maxHeight); i++) {
      if (i < maxWidth) {
        if (i !== 0) {
          w +=
            this._zonedCells.has(`${x - i}_${y}`) &&
            !this._occupiedCells.has(`${x - i}_${y}`)
              ? 1
              : 0
          w +=
            this._zonedCells.has(`${x + i}_${y}`) &&
            !this._occupiedCells.has(`${x + i}_${y}`)
              ? 1
              : 0
        }
      }

      if (i < maxHeight) {
        if (i !== 0) {
          h +=
            this._zonedCells.has(`${x}_${y - i}`) &&
            !this._occupiedCells.has(`${x}_${y - i}`)
              ? 1
              : 0
          h +=
            this._zonedCells.has(`${x}_${y + i}`) &&
            !this._occupiedCells.has(`${x}_${y + i}`)
              ? 1
              : 0
        }
      }
    }

    // Increment width and height by 1 to account for the cell at (x, y)
    return { width: w + 1, height: h + 1 }
  }

  private getSpawnableBuildingForZoneTypeAndDimensions(
    type: ZoneType,
    width: number,
    height: number,
    facingDirection: 'top' | 'right' | 'bottom' | 'left'
  ): Spawnable[] {
    if (!spawnables[type]) {
      return []
    }

    const spawnable = spawnables[type].filter(
      (spawnable) =>
        spawnable.size.width <= width &&
        spawnable.size.height <= height &&
        spawnable.possibleOrientations.indexOf(facingDirection) > -1
    )

    if (spawnable) {
      return spawnable
    }

    return []
  }

  private getClusterSize(points: string[]) {
    return calculateCoordinateDimensions(
      points.map((point) => {
        const [x, y] = point.split('_').map(Number)
        return { x, y }
      })
    )
  }

  private findSpawnableCells(points: string[]) {
    if (this._zonedCells.size === 0) {
      return
    }

    if (this._roadCells.length === 0) {
      return
    }

    if (points.length === 0) {
      return
    }

    const result = []

    points
      .sort((a, b) => {
        const [ax, ay] = a.split('_').map(Number)
        const [bx, by] = b.split('_').map(Number)

        if (ax === bx) {
          return ay - by
        }

        return ax - bx
      })
      .forEach((point) => {
        const [x, y] = point.split('_').map(Number)

        if (this._occupiedCells.has(`${x}_${y}`)) {
          return
        }

        const spawnable = this.pointIsNearRoad(x, y)
        if (spawnable.isNearRoad) {
          result.push({ ...spawnable, x, y })
        }
      })

    return result
  }

  private pointIsNearRoad(x: number, y: number) {
    const neighbors = [
      [x, y - 1],
      [x + 1, y],
      [x, y + 1],
      [x - 1, y],
    ]

    const directions = ['top', 'right', 'bottom', 'left']

    let result = {
      roadSides: [],
      isNearRoad: false,
    }

    neighbors.forEach(([x, y], ix) => {
      if (this.hasRoadCell(x, y)) {
        result.roadSides.push(directions[ix])
        result.isNearRoad = true
      }
    })
    return result
  }

  private hasRoadCell(x: number, y: number) {
    return this._roadCellKeys.includes(`${x}_${y}`)
  }

  private findContiguousZones(
    zoneMap: Map<string, ZoneType>
  ): Map<ZoneType, Array<Array<string>>> {
    const visited = new Set<string>()
    const clustersByType = new Map<ZoneType, Array<Array<string>>>()

    for (const [key, type] of zoneMap.entries()) {
      if (!visited.has(key)) {
        const cluster = this.exploreZone(key, type, zoneMap, visited)
        if (cluster.length > 0) {
          if (!clustersByType.has(type)) {
            clustersByType.set(type, [])
          }
          clustersByType.get(type)?.push(cluster)
        }
      }
    }

    return clustersByType
  }

  private exploreZone(
    start: string,
    type: ZoneType,
    zoneMap: Map<string, ZoneType>,
    visited: Set<string>
  ): Array<string> {
    const [x, y] = start.split('_').map(Number)
    const stack: string[] = [start]
    const cluster: string[] = []

    while (stack.length > 0) {
      const current = stack.pop()
      if (current && !visited.has(current)) {
        visited.add(current)
        const [cx, cy] = current.split('_').map(Number)

        if (zoneMap.get(current) === type) {
          cluster.push(current)
          // Check adjacent cells of the same type
          const neighbors = [
            `${cx + 1}_${cy}`,
            `${cx - 1}_${cy}`,
            `${cx}_${cy + 1}`,
            `${cx}_${cy - 1}`,
          ]
          for (const neighbor of neighbors) {
            if (zoneMap.get(neighbor) === type && !visited.has(neighbor)) {
              stack.push(neighbor)
            }
          }
        }
      }
    }

    return cluster
  }
}
